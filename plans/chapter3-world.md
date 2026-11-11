# Chapter 3's new world: a plan (2026-11-10 / 11) and what the night run built

Built around the scribble fight that already works (`src/scribble.js`, `src/scribblefight.js`, `plans/chapter3.md` sections 7-10:
the camera rising from your eyes, the ring on the real ground, Dodge + two buttons with drawn kind icons, mashing loses, a person
wins in about 1-1.5 minutes). **The build goes in a new session**; this file is what that session starts from (read it after
`plans/chapter3.md`).

House rules that shape every choice: **easy to understand, hard to master** (a child gets it in one look + at most one short line; the
obvious shortcut never wins; naive bot fails, skilled bot wins, real keys, iPad); no Pokémon names; short, friendly text; reuse what
exists (realms, the Picture World kit, the guide, the fight); everything behind `?preview` until the owner opens it.

## Decided overnight (night run 2026-11-11)

Everything below is behind `?preview`, made by the night run on its own (the owner was asleep) and easy to change. Each item: what,
why with an example, where to change it, and the bot numbers. The arena (`arena.html`, `src/arena/`) files are untouched and
turn-based battles do not change.

### Step 1: every attacking move's live kind by its nature

**What:** `MOVE_KIND` in `src/movekinds.js` (from line 305) lists all 239 attacking moves, one word each, grouped by type, with a
comment saying why: e.g. *Big Wave* is a **big blast** (a wave goes all round), *Bubble Pop* **many shots** (bubbles come in many),
*Tide Crash* a **rush** (it crashes in), *Soak Shot* a **shot**. The old rule (power 80+ = big blast) is gone from the game (`kindOf(id)`
in `movekinds.js`); power now only says how hard a move hits within its kind. **The test arena keeps the old rule** (`kindOfMove(m)`,
which its untouched `shapeOf` calls), so arena.html plays exactly as before (its bots: the same results as before tonight). Help moves keep their kinds from their effect (heal, sleep, power up / Tough, cloud): none removed.

**Where to change:** one line per move in `MOVE_KIND`, e.g. `bigwave: 'burst'` -> `bigwave: 'volley'` (the words: `bolt` shot,
`volley` many shots, `dash` rush, `burst` big blast). `node tests/movekinds.mjs` (and the `scribble` spec, part `kinds`) fails on a
damaging move without a line and prints the spread.

**The spread:** 55 shots, 51 many shots, 68 rushes, 65 big blasts (before: 95 / 29 / 29 / 86). **44 of 47 types have all four kinds**
(before: 11). Every creature can learn at least three kinds (273 of 330 all four). Two things worth knowing:
- *Bump* (everyone's first move) is now a **rush** and *Quick Jab* **many shots** (a flurry of jabs), so every creature starts with both.
- The three gaps are types with only three attack moves: **Bug has no shot, Mind and Pixie have no rush.** Filling them needs a new
  move (question 1 below).

**Stretches** (the only reading that gave the type its missing kind; easy to undo): Rainbow *Zenith Ray* rush (rides its own ray in),
Sound *Big Bong* rush (swings in like a bell's clapper), Light *Flash Bulb* rush (there in a blink), Cozy *Lights Out* shot (a puff of
night at one monster), Parkour *Flip Kick* shot (a whoosh of air), Knight *Shield Bash* shot (the shield thrown like a disc), Camo
*Surprise!* shot and *Peekaboo* many shots, Squad *Tower Topple* shot, Cyber *Pixel Pop* big blast, Food *Mega Munch* big blast.

**Nothing saved changes.** The Wizard's Attacks tab reads the same rule: a guardian move whose kind changed (Custom *Swirl Seal*:
big blast -> many shots) shows the new kind's choices (spec `wizard` part `attacks` green).

The list by type (as it stands; "many shots" = volley, "rush" = dash, "big blast" = burst):

- **normal**: Bump rush, Quick Jab many shots, Belly Bash rush, Hyper Strike shot, Never Give Up big blast
- **fire**: Cinder shot, Flare Kick rush, Blaze Burst big blast, Inferno Dash rush, Blaze Dash rush, Wild Blaze many shots, Last Ember big blast
- **water**: Bubble Pop many shots, Soak Shot shot, Tide Crash rush, Big Wave big blast, Royal Tide big blast
- **grass**: Leaf Cut shot, Seed Volley many shots, Vine Lash rush, Root Slam big blast
- **electric**: Zap shot, Static Snap many shots, Thunder Jolt shot, Storm Call big blast, Live Wire rush
- **rock**: Pebble Shot shot, Rumble Rock many shots, Rock Slam rush, Boulder Drop big blast, Cliff Crash big blast
- **ice**: Ice Breath shot, Chill Wind big blast, Snow Storm many shots, Glacier Slam rush
- **bug**: Nibble rush, Buzz Dive big blast, Sting Barrage many shots
- **ghost**: Shadow Dash rush, Boo! many shots, Phantom Strike shot, Gloom Wave big blast
- **mind**: Mind Pulse shot, Mind Trick many shots, Brain Wave big blast
- **metal**: Clank shot, Rivet Shot many shots, Iron Bash rush, Wrecking Ball big blast
- **toxic**: Sludge Spit shot, Goop Shot many shots, Toxic Cloud big blast, Stink Bomb shot, Fizzy Potion rush
- **pixie**: Pixie Dust many shots, Glitter Puff big blast, Moonbeam shot
- **drake**: Scale Swipe shot, Claw Rake rush, Drake Roar big blast, Drake Charge rush, Scale Storm many shots
- **rainbow**: Prism Ray shot, Color Splash many shots, Rainbow Burst big blast, Zenith Ray rush
- **cosmic**: Star Shard shot, Meteor Shower many shots, Comet Crash rush, Supernova big blast, Lucky Star shot, Big Bang big blast
- **sound**: Echo Ping many shots, Shriek big blast, Bass Blast shot, Big Bong rush
- **bone**: Bone Bonk rush, Bone Toss many shots, Fossil Crush shot, Dino Stomp big blast, Rattle Dance rush, Dino Comeback big blast
- **alien**: Beep Beam shot, Tractor Beam rush, UFO Blast shot, Gravity Flip big blast, Mothership many shots, Mystery Button big blast
- **sky**: Breeze Puff shot, Swoop rush, Cloud Burst many shots, Tornado Spin big blast, Jet Stream rush
- **slime**: Slime Shot shot, Sticky Goo many shots, Slime Slam rush, Mega Splat big blast
- **light**: Glint many shots, Flash Bulb rush, Sunbeam shot, Sun Burst big blast, Beacon Beam shot
- **paper**: Paper Flick shot, Confetti many shots, Fold Slam rush, Thousand Cranes big blast
- **time**: Second Hand many shots, Fast Forward rush, Hour Strike shot, Wake-Up Call big blast, Last Second big blast
- **camo**: Peekaboo many shots, Surprise! shot, Blend Bash rush, Statue Slam big blast, Sneaky Leap rush
- **cyber**: Pixel Pop big blast, Rapid Click many shots, Glitch Beam shot, Mega Byte rush
- **cozy**: Snuggle rush, Pillow Fight many shots, Warm Hug big blast, Lights Out shot
- **treasure**: Coin Flip shot, Gem Toss many shots, Gold Rush rush, Crown Jewel big blast, Jackpot big blast
- **squad**: One-Two rush, High Fives many shots, Pile On big blast, Tower Topple shot, Count Off! many shots
- **dream**: Odd Poke shot, Wobble Wave big blast, Floaty Bits many shots, Head Over Heels rush, Crayon Storm many shots, Wild Dream big blast
- **food**: Nom Nom rush, Food Fight shot, Sprinkles many shots, Mega Munch big blast
- **parkour**: Wall Hop big blast, Flip Kick shot, Quick Vault rush, Rooftop Run rush, Triple Flip many shots, Final Sprint rush
- **funfair**: Ticket Toss shot, Bumper Bash rush, Zip Ride rush, Grand Gallop rush, Balloon Burst many shots, Prize Wheel big blast
- **ball**: Bounce Bop shot, Cannon Roll rush, Quick Pass rush, Golden Goal shot, Ace Smash big blast, Trick Shot many shots
- **surprise**: Ribbon Whip rush, Spring Punch shot, Peek-a-Pop rush, Ta-Daa! big blast, Candy Burst many shots, Mystery Box big blast
- **ninja**: Leaf Star many shots, Sneak Step rush, Shadow Strike shot, Leaf Whirlwind big blast
- **racer**: Wheel Spin shot, Ramp Jump big blast, Zoom Dash rush, Photo Finish rush, Nitro Blast many shots, Full Throttle rush
- **tiny**: Teeny Tap shot, Mighty Mite rush, Tiny Steps many shots, Sugar Lift big blast, Fluff Storm big blast
- **pirate**: Hook Swipe rush, Cannonball shot, Swashbuckle rush, Broadside many shots, Anchor Drop big blast, Powder Keg big blast
- **portal**: Swirl Bop shot, Pop Through rush, Shortcut rush, Hat Trick many shots, Door Slam big blast
- **atlantis**: Jar Bonk rush, Tile Toss shot, Rune Glow shot, Sunken Bell big blast, Mosaic Storm many shots, Last Light big blast
- **doodle**: Pencil Poke rush, Sketch Swipe big blast, Quick Draw shot, Lead Lance rush, Squiggle Strike many shots, Finishing Touch big blast
- **knight**: Shield Bash shot, Lance Charge rush, Quick Parry big blast, Grand Joust rush, Quill Volley many shots, Last Charge rush
- **bubble**: Soap Bop shot, Foam Crash rush, Quick Fizz rush, Duck Fleet many shots, Bathtub Wave big blast, Soap Juggle many shots, Last Bubble big blast
- **gravity**: Pull In shot, Orbit Spin big blast, Comet Dash rush, Comet Tail many shots, Ring Toss shot, Upside Hug rush, Last Orbit big blast
- **mirror**: Glint Shot shot, Flash Back big blast, Quick Copy rush, Mirror Mirror many shots, Copycat Combo many shots, Funhouse Squish rush, Round the Corner shot, Last Look big blast
- **custom**: Brush Dab shot, Palette Blast big blast, Quick Stroke rush, Swirl Seal many shots, Final Touch big blast

### Step 1b: wait and hit strength per kind, speed counts

**One place per kind:** `KIND_NUMBERS` in `src/scribblefight.js` (line 55). `wait` = seconds before the move can be used again,
`hit` = x the damage sum (the same sum as a turn-based battle: level, attack / defence, the move's power, same type, the type chart).

| Kind | Wait | Hit | Its own rule | In plain words (power 75, the same creature) |
| --- | --- | --- | --- | --- |
| Shot (`bolt`, line 57) | 0.65 s | x1 | flies straight, a hill stops it | the steady one: one ball every 0.65 s |
| Many shots (`volley`, line 59) | 1.6 s (was 1.6) | **x0.68 a ball** (was x1), 4 balls | the fan is a bit wider: **0.12** rad apart (was 0.09) | close up all four land (x2.7), at 5 blocks the outer two often miss (x1.4): easy to land some, hard to land all |
| Rush (`dash`, line 63) | **1.8 s** (was 2.0) | **x2.4 when timed** in the last half of a warning, **x1 otherwise** (`plain`; was x1 always) | timed: stops the attack and carries you through (built 2026-11-09) | a timed rush is the biggest single hit; a mashed one is a plain bump right next to the monster |
| Big blast (`burst`, line 66) | **2.8 s** (was 3.2), counted from the press | **x2.8 full** (was x2.0), x0.35 when let go at once | the ring grows 2 -> 5 blocks in 1.1 s; hits everything inside | hold, wait for the ring to turn white, let go: x2.8 on every monster inside |

Help moves keep their waits (heal 9 s, power up 9 s, slow cloud 6 s, sleepy cloud 7 s; lines 68-76).

**Why these:** at the same power each kind alone should be worth about the same to a skilled player, each in its own way, and none may
help a masher. Measured with `node tests/scribblemeasure.mjs kinds` (Owlucid x3, Lv 30, every attack at power 75, Sound moves which are
neutral to all three monsters; 6 fights x 3 seeds, 60 and 20 fps):

| Kit | Skilled: time to win | Person: won | Kid: monsters' HP left | Masher: won |
| --- | --- | --- | --- | --- |
| Shot + shot (yardstick) | 45 s | 6 / 18 | 47 % | 0 / 18 |
| Shot + many shots | 48 s | 14 / 18 | 56 % | 0 / 18 |
| Shot + big blast | 51 s | 11 / 18 | 58 % | 0 / 18 |
| Shot + rush | 53 s | 11 / 18 | 62 % | 0 / 18 |
| Shot alone | 90 s | 3 / 18 | 76 % | 0 / 18 |
| Many shots alone | 102 s | 10 / 18 | 82 % | 0 / 18 |
| Big blast alone | 92 s | 8 / 18 | 73 % | 0 / 18 |
| Rush alone | 112 s | 4 / 18 | 78 % | 0 / 18 |

Before the change (the same kits): many shots alone 52 s (far too strong at power 75: four full balls), big blast alone 120 s, rush alone
167 s. Each kind now has its own character: **many shots** are the easiest for a person (most wins), the **big blast** hits hardest when
held, the **rush** pays only when timed (alone it is the slowest, because a skilled player only rushes at a warning), the **shot** is safe.

**Multi-hit moves** (Seed Volley, Rivet Shot...: power 20-30 hitting 1-5 times in a turn-based battle) fight with power x 2.9 (their
average number of hits there), so their live strength is their turn-based strength (`MULTI_HITS`, line 82).

**The monsters got tougher: HP x10 (was x8)** (`foeHp`, line 21). With the kinds by nature the ready-made team (Blazehound, Tidalord,
Thunderwolf at Lv 30) learnt more rushes and blasts, and mashing won 15 of 72 fights at first (seed 122: 7 / 24, over the quarter);
the untimed rush (x1) and x10 HP brought it back down. `node tests/scribblebots.mjs` and `scribblemeasure.mjs length` (6 x 3 seeds):

| Team | Masher | Kid | Person: median win (range) | Skilled |
| --- | --- | --- | --- | --- |
| Ready-made (Lv 30) | 3 / 72 won (4 %) in the final `scribble` spec run (0-2 per 24 a seed); 2 / 18 in `length` | 17 / 18 | **46 s (33-70)** | all, 24 s |
| The owner's team (Graphitan 56, Kitegale 91, Blazehound 89) | 1 / 18 | 6 / 18 | **73 s (55-94)** | all, 46 s |

The ready-made team is quicker than the 1-1.5 minutes (it is rush- and blast-heavy now); the owner's team is right in it.

**Speed counts** (owner, decided): `SPEED` in `src/scribblefight.js` (line 86): **base speed 40 or less = x0.85 walking and dodging,
110 or more = x1.15, a straight line in between** (median creature, base 70: x0.99). Monsters follow the same rule. Example:
Thunderwolf (base 100) walks 4.6 x 1.11 = 5.1 blocks a second, a slow creature (base 40 or less) 3.9. Measured: the band hardly
changes the ready-made team (person 46 s with or without it), but walking out of the red is where speed shows: with everyone at x0.85 a
skilled player is hit about twice as often (19 % vs 9 % of the squad's HP a minute) and still always wins, so no creature is hopeless.

**Speed up** (its own help move, icon » with speed lines, word "Speed up"): the three speed-raising moves (*Dribble*, *Rev Up*,
*Fizz Up*) now make your creature walk and dodge x1.3 for 8 s (`speed`, line 76), instead of the attack boost they gave before. The
plan said 14 speed-raising moves; the moves list has only these three (12 more *lower* a monster's speed: they stay slow clouds). It is a
mild help for now: the bots do not use the extra speed well (skilled 88 s with it, the same as Tough or a slow cloud). The arena still
reads these three as power up (its files are untouched; the fight's `liveShape` says Speed up).

### Step 2: Wobbleland as data

**What:** `src/wobbleland.js` (Node-runnable, 224 x 224, the same for every seed): Inkpot Camp at the south edge (a round clearing with a
ring of coloured wool, planks in the middle, Healer Stella, the way back on three steps), Puddle Meadow with its wonky things (14
leaning and corkscrew trees, soft bulgy hills, six puddles, a river drawn with a slipping ruler, a flower taller than a house, a cloud stuck
on a hill, a house too small for its huge door, stairs to nowhere, a mushroom hill), **six patches** and the Scribble's wall across the
whole page at z 120-121 (12+ blocks high, a keep). Behind it the land is already there (Bumpy Hills' taller bumps, the Big Knot's spot).
The whole page is a keep (nothing can be built, so there are never realm edits). Choices: a hand-made land (every patch spot checked) instead
of a seeded one; the Camp south and the wall straight across, so "the next region is behind the wall" is one look.

| Patch | Where | Size | Monsters (meadow types) |
| --- | --- | --- | --- |
| 1 | right in front of the Camp | smudge | Sproutle, Hopsy |
| 2 | west | smudge | Beetlet, Chirpit |
| 3 | east | tangle | Flutterby, Ripplet, Kiteling |
| 4 | far west, **a puddle in its ring** (the water twist) | tangle | Bubbuck, Jellume, Budling |
| 5 | far east | tangle | Hornbeetle, Woolumph, Balloony, Mossloth |
| 6 | the middle, by the wall | **knot** | Thornox, Gullop, Monarchwing, Bounceroo + the Grumble Grovebeast |

**Where to change:** `PATCHES` (`src/wobbleland.js` line 28: spot, size, species; ids are saved, so only add), `CAMP` (15), `WALL` (19),
`BULGES` (40), `TREES` (51) and the things after it. **Checked** (`node tests/wobblecheck.mjs`, spec `wobble` part `land`): every patch can
be reached on foot from the Camp (22 813 cells walkable), every ring is 100 % walkable, only patch 4 has water in its ring (58 cells), no
rings overlap, and nothing north of the wall can be reached (26 880 cells there, for later).

### Step 3: the Paper Door

**What:** a 3 x 3 crumpled-paper door in the **south wall of the Wizard's tower** on his island (`paperDoor` in `src/wobbleland.js`, drawn
by `src/portal.js`: cloth cells under a cream-and-grey swirl), **only for the Wizard's Ally and only with `?preview`**. Tap / E = down to
Inkpot Camp (realm `wobble`, `src/realms.js`, registered only with `?preview`); the way back is the frame at the top of the Camp's steps
(jump up them), which brings you out in front of the Paper Door. Saved like any Picture World (a reload inside keeps you there); a friend
can follow the host (`entrance: 'paper'`, the generic follow code; not tried with two browsers tonight).
Pictures: `plans/chapter3/wobble-door.png` (the door, close up).

### Step 4: the look

**What I chose:** all three options together (A wonky shapes, B the curl, C first-draft colours), plus the Scribble's grey.
- **The curl** (B): the page bends up with distance like a sheet curling at its edges: flat for the first 28 blocks, then lifted
  0.0025 x (distance - 28)^2 (2.6 blocks up at 60 away, 13 at 100). Models far away (creatures, people, tangles) are lifted the same way
  for each frame, so nothing sinks into the curl. **The on/off switch:** `WOBBLE_LOOK.curl` in `src/wobblelook.js` line 16 (`false` = a flat
  page), and in the game the pause screen's **📄 Page: curls / flat** button (only in Wobbleland). How strong: `curlFrom` / `curlK` (17-18).
- **First-draft colours** (C): louder (saturation x1.45), a bit lemony, chunky dark outlines on block edges (`draft`, `sat`, `line`, line 19).
- **The Scribble's grey:** wherever the Scribble is, the blocks are grey with diagonal scribble strokes. The Camp is always in colour; a
  cleared patch floods its colour out in a circle of 17 blocks over 2 s (`cleared`, `flood`, lines 21-23); a cleared knot colours the
  whole meadow. One small colour map (one texel per 4 x 4 blocks) tells the shader where.
- Everything sits behind a material define (`WOBBLE`) that exists only while you are in Wobbleland. **Checked:** the main world draws the
  very same picture byte for byte as the build from before tonight (seeds 1 and 22), and before and after a trip there (spec `wobble`
  part `look`). Draw calls at the Camp: 160 with and without the curl (the curl costs no draw calls; it is one line in the vertex shader).
  The iPad's frame rate cannot be measured here; the shader adds a few lines per pixel, about what the Sketchbook adds.
- Pictures: `plans/chapter3/wobble-look-curl.png` (the curl, from the Camp), `wobble-look-flat.png` (switch off), `wobble-look-flood.png`
  (patch 1 cleared: its colour flooded out round it).

### Step 5: patches from data in the fight

**What:** in Wobbleland the scribble fight takes its patch from `PATCHES`: the live patch is the nearest one you have not cleared (a
patch 8+ blocks nearer takes over as you walk), its monsters are its own species, and **its size sets the fight** in one table,
`PATCH_SIZES` (`src/scribblefight.js` line 108):

| Size | Monsters | Level (your strongest creature +) | Their HP | Time between their attacks | Their patterns |
| --- | --- | --- | --- | --- | --- |
| smudge | 3 | +1 | x2.0 | x0.44 (often) | charge only |
| tangle | 3-4 | +0 | x1.3 | x0.6 | charge and lob |
| knot | 4 (+ the Grumble, step 7) | +2 | x1.15 | x0.65 | charge, lob and stomp |

(x = on top of the test patch's numbers: HP x10, power 60, rhythm x0.7.) Each monster's **pattern comes from its nature**
(`patternOf`, line 117): heavy Rock / Metal / Bone bodies stomp, creatures whose attacks are mostly rushes charge, the rest lob; a size
that does not allow it falls back. **The water twist:** in water everyone swims slowly, **Water creatures at full speed** (`swimOf`), on
patch 4 (a puddle in its ring) and anywhere else with water. A first win: the key `pw:wobble:patch<id>` (saved at once), **+3 Capture
Cubes** (`WOBBLE_CUBES` in `src/scribble.js`), the colour floods out, the next patch goes live. A lost fight: walk out and back in.

**Why "smudge = 3 monsters" (the plan said 2):** with two monsters mashing won 17-24 of 24 fights whatever their level, HP or pattern
(once one falls, one attacker cannot punish standing still); with three it is 2-4 of 24.

**Bot numbers** (`node tests/wobblebots.mjs`, spec `wobble` part `patches`; per patch: mashing 12 fights at each of 60 and 20 fps,
skilled and person 2 each):

| Patch | Mashing, a type-neutral team (Owlucid x3, Lv 30) | Mashing, the ready-made Fire / Water / Electric team | Mashing, the owner's team | Skilled | Person: wins in |
| --- | --- | --- | --- | --- | --- |
| 1 smudge | 2-3 / 24 | 2 / 8 | 7-8 / 8 | all | 41-55 s |
| 2 smudge | 0 / 24 | 8 / 8 | 8 / 8 | all | 23-54 s |
| 3 tangle | 3-4 / 24 | 7-8 / 8 | 8 / 8 | all | 24-116 s |
| 4 tangle, water | 0-4 / 24 | 3-5 / 8 | 5-7 / 8 | all | 32-149 s |
| 5 tangle | 0 / 24 | 0 / 8 | 0-1 / 8 | all | 37-138 s |
| 6 knot | 0 / 24 | 0 / 8 | 0-1 / 8 | all | 29-107 s |

**Mashing is judged with a type-neutral team**, because Puddle Meadow's monsters are Grass, Bug, Normal, Water and Sky, and a Fire or Sky
team hitting them twice as hard is the type chart doing what the plan wants ("a team that beats them has an easier time"). The catch:
**your own team (Kitegale and Blazehound) can mash the first four patches** (question 4 below).

### Step 6: the loop

- **The arrow** leads to the nearest patch you can fight (`wobbleAim`); **"Where to go"** has a row per open patch (`src/destinations.js`).
  **The knot comes last:** it opens only once the other five are clear (`openPatches` in `src/wobbleland.js`: the one rule the arrow,
  the rows and the fight read). Checked: a naive kid that only walks the way the arrow points (jumping one block when it bumps into a
  step) reaches all six from the Camp, in the order 1, 2, 4, 3, 5, 6, never stuck (`tests/wobblecheck.mjs`).
- **The meter chip** `🎨 Puddle Meadow n / 6` (`meadowState`).
- **Freed creatures are catchable:** each patch's monsters (and the Grumble, rarer) live in the meadow as ordinary wild creatures once
  their patch is cleared (`FREED_SPAWNS`, the `wobble:<id>` checks in `src/wildafter.js`; normal turn-based battles and catching).
- **The Camp:** Healer Stella and the Wizard (his first line: *"The Scribble is in my very first drawing. Let's colour it back in!
  Grey means the Scribble."*); after each first win he says how far you are (`wizardLine`: "You did it! Look, the colour is coming
  back!", "Wonderful! 3 more to go.", "Only the big knot is left. Be careful: something grumbles in there!").
- Found and fixed on the way: the curl lifted the whole fight (its container sits at the map's corner), so on the iPad the creatures
  vanished; containers are now lifted child by child.
- Spec `wobble` parts `loop` and `ipad` (the iPad: touch controls, the meter, the joystick walks you into patch 1 and the fight starts).
  Picture: `plans/chapter3/wobble-ipad-fight.png` (the monsters are grey in a grey patch: question 5).

### Step 7: the knot and its Grumble (the end of the first slice)

- **The Grumble** (Grovebeast, `GRUMBLE` in `src/scribblefight.js` line 137): 2.9 blocks tall (others 1.7), x1.8 HP on top of the knot's,
  a stomper, and it **turns slowly** (1.1 rad/s) so you can get round it. **A hit counts fully only on its back** (more than 100 degrees
  off its front) **or in the 1.3 s right after its own attack**; any other hit does x0.25 and says "Bonk!". The weak spot is shown, not
  told: a yellow glowing ball on its back that swells and pulses while its back is open. Example: a power-75 shot does 5 on its front,
  22 on its back or right after it stomped.
- **Bot numbers** (patch 6, `tests/wobblebots.mjs`): mashing 0 / 24 (it stands in front of the Grumble), the type-matched and the
  owner's team mashing 0 / 8 each; skilled 4 / 4 (it clears the small ones first, then gets behind it and hits when its back is open);
  person 94-141 s (the knot is the region's longest fight; with x2.4 HP and x0.2 on the front it was 96-203 s).
- **The win:** the whole meadow floods with colour, the Scribble's wall melts (drawn live, so a reload melts it again from the saved
  knot key; `meltWall` in `src/wobblelook.js`), the Wizard says *"Puddle Meadow is bright again! Next: Bumpy Hills."*, and walking past
  the wall says *"Bumpy Hills is still being drawn. Coming soon!"*. Pictures: `plans/chapter3/wobble-knot.png` (the knot's fight),
  `wobble-meadow-bright.png` (after the knot: the meadow in colour, the hills behind still grey).
- **Not built yet:** the region's flags flying over the Camp (flags are step 8, after your verdict), any patch in Bumpy Hills.

### What is not done / known limits

- Two browsers (a friend following you down the Paper Door) use the generic follow code but were not tried tonight.
- Only the live patch (the nearest open one) has its tangle and monsters drawn; the others show only as grey land with the arrow and
  "Where to go" rows pointing at them.
- The fight's numbers for the old main-world test patch changed with step 1b too (HP x10, the kinds' numbers); its spec is green.

## Questions for the owner (from the night run)

1. **Moves:** are the kinds by type right (the list above)? The stretches I am least sure of: *Zenith Ray*, *Big Bong* and *Flash Bulb*
   as rushes, *Lights Out*, *Flip Kick* and *Shield Bash* as shots. Bug, Mind and Pixie can only get their fourth kind with a new move:
   should they get one?
2. **Speed up:** only three moves raise speed (*Dribble*, *Rev Up*, *Fizz Up*), not 14. Should more moves (e.g. the "Quick ..." moves,
   or *Rush Hour* / *Race Day*) become Speed up?
3. **The look:** do you like the curling page on the iPad, or should the switch go off (pause screen: 📄 Page)? Is the grey with
   scribble strokes readable, and are the first-draft colours too loud?
4. **Your team can mash the first patches:** Puddle Meadow's monsters are weak to Fire and Sky, and your Kitegale and Blazehound win
   the first four patches by mashing. Fine (types should matter), or should the meadow hold types your team is not strong against?
5. **Grey monsters in a grey patch** are hard to see (`wobble-ipad-fight.png`): give them a coloured outline or keep them grey?
6. **The knot** takes a person-like bot about 1.5-2.5 minutes. Too long for your son, or right for a region's end?
7. Is the order **smudge, smudge, tangles, knot** with the knot opening last the right pace? (Smudges have 3 monsters now, not 2.)

## Owner's first play (2026-11-11) and the plan for the next session

**Fixed the same day:** *"Why was the red warning removed in the scribble world? Why can't I see the fight's boundaries?"* Both were
the curling page (step 4): to bend far things up with the page, every frame lifts each model by its distance from you. The fight's red
warnings, its ring fence and the patch on the ground are meshes whose position is the map's corner (their shape is already in world
places), so they were lifted some 100 blocks into the sky. A mesh like that is never lifted now (`beforeRender` in
`src/wobblelook.js`), and the spec checks that nothing of a fight moves (`wobble` part `ipad`). Picture: `tests/screenshots/wobble-warning.png`.
Nothing about the fight's rules changed (the owner: "battle mechanics are fine, moves are all great").

The rest is a plan only (to build in a new session):

### A. Too much empty space ("we could use all this space")

Today the six patches sit 30-65 blocks apart on a 224-wide page, with nothing between them. Plan, in this order:
1. **Pack the meadow.** Puddle Meadow becomes a compact area about 110 x 70 round the Camp (patch centres about 25-30 apart, rings
   still 20 across and never touching); the other regions move in right behind it (Bumpy Hills, Slippy Lake and Shadywood each a
   neighbour of the meadow, the Big Knot in the middle), so the walk from one patch to the next is 10-15 s, not 30-60 s.
   `PATCHES` / `BULGES` / `WALL` in `src/wobbleland.js`; `tests/wobblecheck.mjs` keeps checking reach, rings and walls.
2. **More to do on the way** (each one look, no text):
   - **Scribble bugs**: little scribbles that scuttle over the grey ground; walk into one and it pops into a puff of colour (+ a paint
     drop for the workshop later). A chase, not a fight: they run from you a bit faster than you walk, and stop at walls (a corner
     trap, like the Mirror Palace's Gloomies). 3-5 near each patch, gone once it is cleared.
   - **Freed creatures** already roam once a patch is cleared; give each cleared patch 1-2 that stay near it so the meadow fills up.
   - **Smudges in a row**: between two tangles, a path of 2-3 one-monster "blots" (a 10-second fight each) that open the way.
3. **Paint-pot hops (fast travel):** every cleared patch leaves a paint pot; stand in one and tap = hop to any other cleared pot or the
   Camp. It is earned (clear first) and fits the drawing.

### B. Riding and flying ("why can't I ride or fly my creature here?")

There is no good reason: the night run copied the Bubble Well's "the whole map is a keep, no riding" rule. Plan:
- Remove `noRide` from `REALMS.wobble` (`src/realms.js`) and give the whole-page keep `rideIn: true` (`src/wobbleland.js`): riding and
  sky riding everywhere, building still not allowed.
- Keep riders out of a patch's ring (a small keep per patch without `rideIn`), so you hop off at the ring and the fight starts on foot
  as now (`scribble.js start()` already stops riding).
- Check the curl from the sky (higher up you see more of the bent page; maybe a smaller `curlK` while flying) and the iPad frame rate
  when flying over the whole page.

### C. "More different than our regular world"

Today it is our blocks, recoloured, on a bending page. The next steps, all behind the `WOBBLE` define like the curl (the main world stays
byte for byte the same; no block ids are free, so it is all looks):
1. **Wobbly hand-drawn blocks:** in the vertex shader, every block corner moves a fixed little bit (a hash of its place, up to 0.12;
   never over time, so nothing shakes), so no edge is straight: the whole land looks drawn by hand. Only the look: walking and the
   fight keep the real cubes. Check that feet never sink into the ground visibly and that there are no cracks.
2. **A crayon atlas:** a second texture drawn like the Sketchbook's pencil atlas, but in wax crayon (thick strokes, gaps where the paper
   shows, colours going over the lines), swapped in only here (`sketch.js` shows how).
3. **A child's sky:** a big drawn sun with rays and a smile, flat cotton clouds hanging on strings, a sky coloured in with streaky
   crayon (one sky dome, like the Swirl's `swirlsky.js`).
4. **Shapes our world can never have:** hills that float on strings, trees upside down, giant crayons stuck in the ground as pillars,
   a river that runs uphill (animated), fold creases across the page as ridges, and at the page's edge torn paper and the Wizard's desk
   far below instead of an invisible wall.
5. **Ways to move that only a drawing has:** drawn springs (bounce high, like Cube Planets' spring flowers), slides drawn down the
   hills, a zip-line drawn between two trees. They also help with A (less walking).

**Suggested order:** B (small, the owner asked first), then A1 + A3 (less walking), then C1 + C3 (the biggest "different" for the
least work), then A2, C2, C4, C5. Each with the usual naive / skilled bots, real keys and an iPad run; the curl switch stays.


## Built from the owner's first play (session 2026-11-11, afternoon)

Everything is behind `?preview`, the arena is untouched, the scribble fight's rules did not change. Each item: what, why with an example,
where to change it, the bot numbers.

### B. Riding and flying

**What:** Wobbleland has no `noRide` any more (`src/realms.js`, `REALMS.wobble`), and the page's keep has `rideIn: true`
(`src/wobbleland.js`, the `world.keeps.push({ name: 'wobble', rideIn: true ... })` line): ride and fly anywhere, building still not allowed.
**Choice: no keep round the patches.** The plan said "keep riders out of a ring"; I chose instead that **riding into a patch hops you off
and starts its fight** (`start()` in `src/scribble.js`: "You hop off. The Scribble is here!"), and a creature flying low (up to 8 above the
patch; `canStart`) lands you in it too. Why: a fence makes a child bump, read a toast and press R; hopping off is one look. Example: ride
Blazehound north from the Camp: at patch 1 you are on foot and the camera rises into the fight. R does nothing during a fight
(`src/riding.js` `start`). **The Scribble's wall fences riders** (its keep has no `rideIn`; when it melts, `meltWall` drops world.js's
cached fences too). Flying is capped at 6 over the ground as everywhere, so the curl from the sky looks as from a hill (no smaller
`curlK` needed). Spec `wobble` part `ride` (real keys R / W / Space, land and sky); picture `plans/chapter3/wobble-fly.png`.

### A1. A packed Puddle Meadow

**What:** the meadow is now a box x 62..162, z 134..223 round the Camp (`MEADOW`, `src/wobbleland.js` line 21) and the Scribble's wall
goes round it on three sides (`WALLS`, line 24). Right behind it are the next regions as real, grey land for later (`REGIONS`,
`regionAt`): **Bumpy Hills** north (the old bumps), **Slippy Lake** west (a wide lake with two islands, `LAKE`), **Shadywood** east (a
thick wood, `WOOD`). The six patches are 26-28 apart (`PATCHES`, line 42):

| Patch | Was at | Now at | Nearest other patch |
| --- | --- | --- | --- |
| 1 smudge | 112, 178 | 112, 178 | 26 |
| 2 smudge | 72, 168 | 86, 184 | 27 |
| 3 tangle | 154, 162 | 138, 184 | 27 |
| 4 tangle (wet) | 46, 142 | 84, 156 | 28 |
| 5 tangle | 180, 140 | 140, 156 | 28 |
| 6 knot | 112, 140 | 112, 152 | 26 |

The arrow now shows smudges first, then tangles, then the knot (`SIZE_RANK` in `wobbleAim`), because the packed tangles are as near as the
smudges. **Numbers** (`node tests/wobblecheck.mjs`): the arrow-following kid walks 1, 2, 4, 5, 3, 6 in 578 steps of 0.3 (174 blocks; it was
965 steps, 290 blocks), the farthest patch is 52 from the Camp, 0 stuck. New checks: the nearest other patch is never more than 32 away,
nothing built stands in a ring or the Camp, nothing outside the meadow can be reached. Patch 4's puddle now has 35 wet cells (was 58).
Bots (`tests/wobblebots.mjs`, 60 and 20 fps): mashing with the type-neutral team 1 / 24, 0, 4, 0, 0, 0; skilled all; person 22-156 s.
The knot's wall-melt now melts all three walls; walking into a region still being drawn says so by its name.
Found on the way: a live patch that had been cleared another way (a test pushing keys) stayed live; it now moves on (`S.update` in
`src/scribble.js`).

### A3. Paint-pot hops

**What:** every cleared patch leaves a paint pot of its own colour in its middle (red, yellow, blue, green, pink, purple: `pot` in
`PATCHES`), and the Camp has an orange one from the start (`CAMP_POT`). **Stand in a pot and look the way you want to go**: a beam of the
target's colour stands over the pot you would hop to, the prompt says "Press E to hop to blue" and the round button "Hop to blue!". E / a tap
puffs you there (you land 1.7 south of it, facing north). New file `src/wobblelive.js` (`WobbleLive` = `LIVE.wobble`, a live part).
**Choice: you pick by looking, not from a list.** Why: one look, no panel and no reading; with up to seven pots the one nearest to where you
look is the one (`hopOf`). Example: two patches cleared, in the Camp's pot: look north-west and the red beam rises over patch 1; turn right
and the blue one rises over patch 3. **Earned:** only cleared patches have pots, so the Camp's pot hops nowhere at first (it says nothing).
**Where to change:** `POT` in `src/wobblelive.js` (stand radius `r` 1.3, `land` 1.7, `beam` height), the colours in `PATCHES`.
**Checked:** spec `wobble` part `hops` (real E: Camp -> patch 3 -> Camp; turning picks another pot; iPad: the button says it, a tap hops).
Nothing saved: the pots are drawn from the patches' keys. Picture `plans/chapter3/wobble-pots.png`.

### C1. Wobbly hand-drawn blocks

**What:** in Wobbleland every block corner is moved a fixed little bit: up to **0.12 sideways and 0.06 up or down**, by a hash of the
corner's own place (`WOBBLE_VERT` in `src/caves.js`, uniform `uWobJig`; the number is `WOBBLE_LOOK.jig` in `src/wobblelook.js`, 0 = straight).
Never over time, so nothing shakes. **No cracks:** two blocks sharing a corner share its place, so it moves the same for both (the chunk
mesher draws one quad per face, never merged ones, so there are no T-joints). The fragment shader still reads the real place, so the chunky
outlines and the grey / colour map stay on their faces and follow the wobble. Only the look: walking, aiming and the fight use the real
cubes. **Why half up and down:** a ground corner 0.12 lower would let a creature's feet sink visibly in the fight's top view; at 0.06 they
do not (`plans/chapter3/wobble-ipad-fight.png`). Behind the WOBBLE define: the main world's byte-for-byte check stays green; draw calls
unchanged (the wobble is three lines in the vertex shader).

### C3. A child's sky

**What:** `src/wobblesky.js`: one dome that follows the camera, coloured in with slanted crayon strokes that thin out toward the page's
cream horizon (the same cream as the fog), a **big sun with crayon rays, a smile and pink cheeks** that nods a little, and **seven flat
cotton clouds hanging on strings** from the top of the page, swaying slowly. **Choice:** the sun hangs to the north-west, 27 degrees up, so
it is in view the moment you arrive (you arrive looking north). 4 draw calls (dome, sun, clouds as one mesh, strings as one line set),
none lifted by the curl (`noCurl`). **Where to change:** `SKY` at the top of `src/wobblesky.js` (sun place and size, clouds, the blues);
`WOBBLE_LOOK.sky = false` turns it off. Picture `plans/chapter3/wobble-sky-edges.png` (the sky, the wobbly plank floor of the Camp).

### A2. Scribble bugs

**What:** four little scribbles (a dark knot with two white eyes) scuttle round every patch you have not cleared, 24 at first; walk into
one and it pops into a puff of colour and leaves a splash of colour on the grey (this visit only; nothing saved). A cleared patch's bugs go.
**The rule (one look: "it runs from me"):** a bug notices you within 5.5 and runs straight away from you, **always a bit faster than you
are moving** (x1.08, at least 5.6: a walk is 4.3, a sprint 6.2), so chasing from behind never works, on foot, sprinting or riding. It lives
in a yard round its patch (9 to 18 from the middle: never in the fight's ring, never far off), and **at the yard's edge it can only slide
along it**: come at it from the patch's side when it is at the outer edge and it has nowhere to go. The Mirror Palace's Gloomies' trick
(corner them), kept apart from the fight. **Where to change:** `BUG` in `src/scribblebugs.js` (pure, 1/120 s sub-steps), drawn by
`src/wobblelive.js` (`updateBugs`, `pop`), the splash size `WOBBLE_LOOK.splat` (4.5). **Bots** (`node tests/wobblebugbots.mjs`, 6 runs of 60 s
at each of 60 and 20 fps): **naive** (sprints at the nearest bug) **2 / 24** at both; **skilled** (keeps on the bug's line from the patch,
on the side away from the nearer edge, a little ahead of where it slides, walks the last bit) **24 / 24**, all four in 15-27 s. Real keys
and the iPad's joystick (the kid keeps turning toward it) pop one each (spec `wobble` part `bugs`). Picture `plans/chapter3/wobble-bugs.png`.
**Not built:** the paint drops for the workshop (the plan's "later").

### C4 + C5. Shapes our world can never have, and springs

**What** (all in `src/wobbleland.js`, after `MUSHROOM`): **two hills floating on strings** over the meadow's west and east edges (`FLOATERS`:
a round lump hanging down, a dark string up to the top of the page, **a chest on top: +3 Capture Cubes**, once, saved like any chest);
beside each a **drawn spring** (the Bounce Block underneath, a red crayon coil with a yellow cap drawn over it by `src/wobblelive.js`, squashing
while you stand on it): jump on it and steer onto the hill. **Two upside-down trees** at the Camp's sides (leaves on the ground, roots in the
air, `UPSIDE_TREES`) and **three giant crayons** stuck tip-first in the ground with their paper wrapper (`CRAYONS`).
**Why a chest up there:** a small reward gives the spring a reason; it is a skill (time the jump, steer 8 blocks in the air), and the
obvious shortcuts never work: no building (the page is a keep), a plain jump reaches 1.4, a flying creature is capped 6 over the ground
(the hill's top is 11 up). **Checked** (spec `wobble` part `springs`, real keys): walking at it and holding Space under it: highest 12.3
(the top is 22); on the spring, Space then W: you land on the hill; E on the chest: +3. `wobblecheck.mjs`: nothing stands in a ring or
the Camp (a floater first hung over patch 5's ring and was moved; the fight camera is 12 up). Picture `plans/chapter3/wobble-floating-hill.png`.
**Not built (C4/C5):** the river running uphill, fold creases, the torn page edge with the desk below (the map has no room below the page:
falling off would need a way back), slides and the zip-line.

### C2. Crayon (in the shader, not a second atlas)

**What I chose:** instead of drawing a second crayon atlas and swapping it in (as `sketch.js` does for the pencil), the crayon is a few
lines in the WOBBLE fragment shader (`src/caves.js`, after the Scribble's grey): on land that is coloured in, short slanted wax streaks in
world space with gaps where the cream paper shows through, and a slight unevenness of the wax. **Why:** one switch and one number, it works
on every block (also the wool and planks the atlas would have needed tile by tile), it costs no texture memory or upload, and the grey
(the Scribble) stays the scribbled pencil grey, so "coloured in with crayon" and "scribbled over" read as two different things.
Example: the Camp's green and the flooded patches look coloured in by a child; the grey meadow does not. **Where to change:**
`WOBBLE_LOOK.crayon` in `src/wobblelook.js` (0.4; 0 = flat colour), the streak length and gap share in `WOBBLE_FRAG` (`along * 0.6`,
`step(0.76, n)`). The first try (longer streaks, 0.55) looked like white scratches. Picture `plans/chapter3/wobble-crayon.png` (patch 1
flooded). The main world's byte-for-byte check stays green (it failed once in about six runs in this session, before and after the shader
changes alike: its "before" picture itself changes from run to run; a flake of the check, worth a look).

### What is not done / known limits (this session)

- Not built: the river running uphill, fold creases, the torn page edge, slides, the zip-line (C4 / C5); "smudges in a row" and freed
  creatures that stay near their patch (A2); paint drops for the workshop.
- The iPad's real frame rate cannot be measured here. What the new looks cost: the sky 4 draw calls, the bugs 2, the pots one group of
  a few meshes; the wobble and the crayon are a few shader lines (draw calls at the Camp 257, were 252).
- The `riding` spec fails now and then the same way on the commit before this session (timing in software rendering), not from this work.

## Questions for the owner (from this session)

1. **Riding into a patch** hops you off and starts the fight (no fence round the patches). Good, or would you rather bump into a fence
   and get off yourself?
2. **Paint-pot hops by looking:** stand in a pot, look where you want to go, a beam shows the pot. Is that easy for your son, or should a
   tap open a little list of pots instead?
3. **Scribble bugs** give only a splash of colour now. Should popping them count for something (a paint drop for the workshop, a few
   Capture Cubes for all four round a patch)?
4. **The wobbly edges** (0.12) and the **crayon** (0.4): too strong, too weak, or right on the iPad?
5. **The floating hills** have a chest each (+3 cubes, once). More of them, and with something better on top?
6. The arrow now shows **smudges first** (1, 2, then the nearest tangles, the knot last), because the packed tangles are as near as the
   smudges. OK?
7. Which of the rest next: the river running uphill, slides down the hills, a zip-line between two trees, or the torn page edge with the
   Wizard's desk below?


---


## The owner's answers (2026-11-11 evening) and what was built from them

**Answers:** riding into a patch is fine; paint-pot hops are "a bit unnecessary" (kept, small, one class `PaintPots`: delete it from
`PIECES` in `src/wobblelive.js` to drop them); bugs: just the paint pop, no reward; floating hills: more, with more creatures; arrow ok;
next: my choice, but **nothing that needs E / the action button** (springs, floating river: yes; zip-line: no). Sun and clouds looked "too
obviously SVG". "Object-oriented, no code bloat."

**Built:**
- **`src/wobblelive.js` in pieces:** `WobbleLive` only composes small classes, each one thing: `Puffs`, `PaintPots`, `Bugs`, `Springs`,
  `RiverMarks`, `HillStrings` (`PIECES`). A piece may have `update(dt, p)`, `keysChanged(fresh)`, `near` / `use`, `info`, `dispose`.
  A new thing in Wobbleland = one class + one entry.
- **The floating river** (`RIVER_UP`, `riverY`, `riverFlow` in `src/wobbleland.js`): water on a paper strip that starts on the ground by
  the Camp's west side and runs uphill in steps (one every 4 blocks, 11 steps) to a floating hill with a chest; **step in and it carries you
  up, no button**. It is always drawn in colour so a child sees water; white current marks run up it. Physics: one generic hook,
  `world.flowAt(pos)` (`src/player.js`, `walkStep`: the current is added to your walk, and in water it lifts you over the next step);
  undefined in every other world, so nothing else moves (`jump` and `water` specs green). Checked: spec `wobble` part `river` (no keys:
  carried from the bottom onto the hill, 52 blocks along and 11 up). Picture `plans/chapter3/wobble-river-up.png`.
- **Five floating hills** (`FLOATERS`, was two), each with a chest; four have a spring, one is the river's. Their strings are thin drawn
  lines now (`HillStrings`), not block columns.
- **Freed creatures stay near their patch, and live on the floating hills:** a generic spawn condition `near:<arg>` (`src/spawnrules.js`)
  asks the world where (`world.spawnSpot(arg, playerPos)`, in `creatures.context` as `spot`); Wobbleland answers `patch<id>` = 3-12 from
  that patch's middle, `float` = on a floating hill's grass, only within 45 of you (`wobbleSpot`). `FREED_SPAWNS`: each freed species
  twice, near its patch (weight 1) and on the hills (0.5). More of them: Wobbleland's `wild` is 8 at a time, one every 1.5 s (was 4 / 2.5).
  The Book says "near the patch it was freed from" / "up on the floating hills". Checked (part `river`): 40 / 40 spots round the patch,
  every hill spot on a hill's grass; standing by cleared patch 3, its creatures appear 4-10 away.
- **A hand-drawn sun and clouds** (`src/wobblesky.js`): every outline is a wobbly loop (`wobblyLoop`), lines are crayon strokes drawn twice a
  bit apart (`crayonLine`), the sun's rays are uneven and bent, the colour goes over the line, the eyes are not the same and the smile is
  lopsided; two different lumpy clouds with blue scribble shading. Picture `plans/chapter3/wobble-sky.png`.

## What next: the regions, and places where types matter (my recommendation)

You are right that the first slice showed none of chapter 3's main idea yet (section 6 above: **the real ground decides, and one type has
an advantage a child can see**). Puddle Meadow has only the small water twist. So the next regions should each be built around one ground,
and the fight rules in the meadow stay exactly as they are; a twist only acts on its own ground.

**Order I recommend:** 1. **Slippy Lake** (ice), 2. **Shadywood** (dark), 3. **Bumpy Hills** (high ground), then the Big Knot.
Slippy Lake first because ice is the clearest to see and to feel (the arena already proved it), and it already sits behind the west wall.

| Region | The ground (in the fight AND when you walk) | The type a child sees winning | Ways to move with no button |
| --- | --- | --- | --- |
| **Slippy Lake** | frozen lake: you, your creature and the monsters slide about 2 blocks after letting go; monsters overshoot their charges | **Ice** creatures keep their grip (no skid marks, they stop dead) and so does a Water creature in the lake's open holes | slide down drawn ice chutes from the shore; open water holes with a current that carries you to the islands |
| **Shadywood** | dark under the trees: you see only near your creature's light; a big blast lights it up for a moment | **Fire, Light, Electric, Cosmic** creatures glow: their circle of light is twice as big (you see the monsters' red warnings sooner) | glowing mushrooms you bounce on (springs again), a dark river that carries you between clearings |
| **Bumpy Hills** | steep bumps: a step of two blocks is a wall, a stomp reaches only its own height (already true) | **Sky** and **Drake** creatures hop a two-block step (they flap), so they get up high and above stomps | long drawn slides down the big hills, springs up them, hills on strings |

Each region: its own wall that melts when the meadow's knot is cleared (already built), 4-6 patches whose monsters fit the place (Ice
monsters on the lake also keep their grip, so a fire team has it hard there), freed creatures near their patches, the same naive / skilled
bots per patch with three teams (one that fits the place, one neutral, the owner's), and a table of how much the fitting type helps. The
iPad matters most for the dark (it must stay readable on a small screen).

**Decided (owner 2026-11-11):** Slippy Lake first, and **the ice slides you when you walk on the lake too**, not only in fights (a fun
way to move with no button, and the ground's rule is obvious before the first fight).

## Slippy Lake (built 2026-11-11, evening)

Behind `?preview` like the rest of Wobbleland; the arena (`arena.html`, `src/arena/`) is untouched, turn-based battles do not change, and
in Puddle Meadow (and in the main world's test patch) the fight and walking are exactly as before (no ground rule there: `world.groundAt` is
undefined everywhere but Wobbleland, and in Wobbleland it answers only on ice). Each item: what, why with an example, where to change it,
the bot numbers. Pictures: `plans/chapter3/wobble-lake*.png`.

### 1. The ground rule: one object the player and the fight both ask

**What:** `src/groundrules.js` (pure, no imports): `GroundRule` (plain ground: you go where the stick says at once) and `Ice`. A world says
which rule holds where with `world.groundAt(pos)` (Wobbleland: `iceUnder` in `src/wobbleland.js`: ice under your feet, or under you in a jump),
like `world.flowAt` for currents. `player.js` (`walkStep`) and `scribblefight.js` (`groundOf(world).rule`, `walk`) both move by the rule's
`move`. **Shadywood and Bumpy Hills follow the same pattern:** one more subclass (the dark: `sight(type)`; the high ground: `climb(type)`)
and one line in `GROUND`; nothing else needs to know which ground it is.

**The ice, in numbers** (`Ice` in `src/groundrules.js` line 27):
- **Letting go:** the speed eases to nothing at `k` 2.15 a second, so from a walk (4.3) you glide **1.9 blocks** (a sprint 2.7), the same at
  60 and 20 fps (`tests/wobblenode.mjs`, the real Player). Example: walk west onto the lake, let go of W: you keep going about two blocks
  and leave two dark skid lines.
- **Getting going and turning is slower than stopping** (`go` 1.0): on ice it is hard to start and to turn. **Why:** with `go` = `k` the slide
  made no measurable difference to any bot (a creature at a walk gets 2.5 blocks out of a red warning in its 0.95 s either way); with `go`
  1.0 a creature that slips and sees a warning late gets out of it later, which is where keeping your feet shows (below). The glide after
  letting go stays the decided "about 2 blocks".
- **Ice creatures keep their grip:** they start, turn and stop at once and leave no skid marks; so do **Ice monsters**. Riding an Ice creature
  on the lake keeps its grip too (`riding.js` puts the ride's type on `player.ride`); a Fire ride glides 2.3.
- **In a fight:** your creature and every slipping monster glide; a rush or a dodge skids on after it ends (`rush` 4, `dodge` 3 a second of
  speed left: about 2 and 1.4 blocks); **a slipping monster's charge overshoots** (`past` 1.5: its red line is drawn that much longer, so
  you see it) and skids on; and **slipping monsters skate at you** (`pattern`: on ice they charge, whatever their nature; Ice monsters keep
  their own way of fighting). **Why the last one:** every Ice, Water, Bubble and Sky creature lobs by its nature (`patternOf`), so without it
  nobody on the lake would ever charge and "monsters overshoot their charges" would never be seen.
- **Skid marks** (`src/skidmarks.js`, one instanced mesh): under you while you slide (`wobblelive.js` `Skids`) and under every fighter
  that slides (`scribble.js`). Picture `wobble-lake-skid.png`, `wobble-lake-fight.png` (your creature's tracks behind it).
- **Tried and dropped:** a monster still skidding after its charge could not start an attack (a window to hit it). It helped mashers more
  than anyone (a neutral team's mashing on one patch went to 8 / 24), so it is gone.

### 2. The lake as terrain (`src/wobbleland.js`, `LAKE` line 107)

**What:** behind the meadow's west wall (x 0..59, z 134..223): the ice is a rounded square (`lakeShape`: |dx/26|^4 + |dz/39|^4 <= 1, so the
rings in its corners are on the ice), ICE over water at y 8 (you stand one lower than in the meadow), a snowy shore rising to the meadow's
height, two snowy islands (`LAKE.isles`), two stepped snow hills in the east corners (`LAKE.hills`). **Five patches, all on the ice**
(`tests/wobblecheck.mjs`: every ring 100 % ice or open water, 100 % walkable):

| Patch | Where | Size | Monsters (the Ice one keeps its grip) |
| --- | --- | --- | --- |
| 7 | south-east, nearest the way in | tangle | Frostling, Squeaklet, Skyfin |
| 8 | north-east | tangle | Waddlice, Suddly, Pinwhirl |
| 9 | south-west, **two holes of open water** in its ring | tangle | Flurrydome, Hippip, Shellby (a Water one: it swims fast in the holes) |
| 10 | north-west | tangle | Snowpaw, Balloony, Fizzbomb |
| 11 | the middle, three holes | **knot** | Frostling, Suddly, Skyfin + **Blizzbear**, an Ice Grumble (it keeps its grip; its back is its weak spot as in the meadow) |

**Choices and why:**
- **One Ice monster per patch, the rest Bubble ducks and Sky birds** (not "Ice and Water mostly"): Ice moves do half to Water and Ice. With
  mostly Ice and Water monsters, an Ice team hit everything at half and won slower than a type-neutral team (person bot, first try: the Ice
  team 0 / 4 on the knot), so the grip could never show. Example: an Ice team's Snow Storm does x2 to Skyfin, x1 to Squeaklet, x0.5 to Frostling.
- **No smudges; tangles from the start, 2 levels up** (`step: 2` on each lake patch, read by `patchFight` in `src/scribblefight.js` line
  131): the second region is a step harder. As smudges (3 monsters, x2 HP, charging often) the first two lake patches were mashed by the
  neutral team 7-8 / 24.
- **The knot has three monsters and its Grumble, no extra levels:** with four and +2 levels no person or kid bot won it on the ice (0 / 6),
  even with the Ice team.
- **The way in:** the meadow's knot now melts **only the west wall** (`WALLS` `to: 'lake'`; a wall melts when the region behind it opens,
  `REGIONS` `after`: lake after meadow, Shadywood after the lake, Bumpy Hills after Shadywood). Before, all three walls melted into empty
  "coming soon" land. A new wall closes the lake from Bumpy Hills (north). The lake's knot melts the meadow's east wall: "Shadywood is still
  being drawn. Coming soon!".
- **The loop is the meadow's:** the meter chip shows the region you stand in (`🎨 Slippy Lake n / 5`), the arrow and "Where to go" list the
  open patches (`openPatches`: a region's patches only once it is open, its knot last), the Wizard's words per region (`wizardLine(n, of,
  region)`: "Ice is slippy, but you kept your feet!", "Something big skates in there!"), +3 Capture Cubes and the colour flood per patch,
  the whole lake in colour after its knot. Freed creatures stay near their patch and live on the islands (`near:isle`, the lake's own
  spawn table `freedSpawns('lake')`). Scribble bugs and paint pots come with the lake once it opens.

### 3. Ways to move with no button

- **Ice chutes** (`CHUTES`): a stepped snow hill in each east corner (one block up every 1.25: walk and jump up it), an ice chute down its
  side with a snow kerb each side; standing in it pushes you down (`lakeFlow`, 8 a second) and, because the push is part of your glide on
  ice, you shoot out at the bottom at about 8 a second (`player.js`: on ice a push under you is part of what the glide eases toward).
- **Leads** (`LEADS`): open water in the ice running from each chute's foot to the east island, with a current (3.6 a second); at the
  island a last push climbs you out (a push of 10.5 up: one block out of the water). **Checked** (`tests/wobblenode.mjs`, the real Player,
  no keys at all): from either chute's top you land on the east island in 9.5 s, at 60 and 20 fps; in a browser with real time the same
  (spec part `lake`). Picture `wobble-lake-chute.png`.
- **A floating hill over the west island**, its drawn spring on the ice beside it (`FLOATERS`, the sixth): Space on the spring and steer:
  you land on top (a chest, +3 cubes once); a plain jump from the island reaches 11.4 of the 21 needed.
- **Not built:** the springs on the shore to climb the hills (the hills are low steps), a current between the two islands.

### 4. The look (behind the WOBBLE define: the main world is byte for byte the same)

- **Ice that is clearly ice**, coloured in or under the Scribble's grey: on the lake's top faces the shader draws one smooth pale-blue sheet
  (no block grid, the tile's pixels only a faint tone) with long shiny streaks slanting across it in world space (`wobIce` in `WOBBLE_FRAG`,
  `src/caves.js`; which cells are ice is the green channel of the colour map, `iceMap` in `src/wobblelook.js`). Under the Scribble it is a
  greyer blue, coloured in a bright ice blue. Open water stays water. The chutes and the leads are always in colour (like the floating
  river: a child must see the water and the slide to step in).
- **Skid lines** (above), **the crayon and the wobbly edges** as in the meadow (the same shader), snow on the shore, the islands and hills.
- Pictures: `wobble-lake.png` (from the east shore, grey), `wobble-lake-skid.png`, `wobble-lake-chute.png`, `wobble-lake-fight.png`,
  `wobble-lake-knot.png`, `wobble-lake-bright.png` (the lake after its knot), `wobble-lake-ipad-fight.png` (the iPad, a fight on the ice).

### 5. Bot numbers (`node tests/wobblebots.mjs` `runLake`, spec `wobble` part `lakebots`; every lake patch, 60 and 20 fps)

Three teams at Lv 30: **Ice** (Snowpaw, Flurrydome, Waddlice: base stats close to the neutral team's), **neutral** (Owlucid x3, Mind),
**the owner's** (Graphitan 56, Kitegale 91, Blazehound 89). Mashing 12 fights a frame rate (the owner's 4), skilled and person 2 each.
"Loses" = % of the squad's HP lost a minute.

| Patch | Mashing won: Ice / neutral / owner | Skilled (all won): Ice / neutral / owner, time and loses | Person won: Ice / neutral / owner, time and loses | Neutral person, ice off |
| --- | --- | --- | --- | --- |
| 7 tangle | **24 / 24** / 2 / 24 / 7 / 8 | 25-30 s, 20 % / 32-37 s, 11 % / 22-43 s, 36 % | 4 / 4 48-75 s 40 % / 4 / 4 57-79 s 62 % / 4 / 4 37-52 s 37 % | 4 / 4, 4 % |
| 8 tangle | **24 / 24** / 3 / 24 / 7 / 8 | 25-47 s, 19 % / 25-41 s, 46 % / 26-49 s, 22 % | 4 / 4 50-81 s 37 % / 4 / 4 59-88 s 59 % / 4 / 4 37-69 s 46 % | 4 / 4, 4 % |
| 9 tangle, holes | **20 / 24** / 1 / 24 / 4 / 8 | 47-55 s, 6 % / 35-54 s, 30 % / 27-49 s, 29 % | 3 / 4 113-145 s 41 % / 3 / 4 92-102 s 52 % / 4 / 4 51-77 s 56 % | 4 / 4, 0 % |
| 10 tangle | **24 / 24** / 0 / 24 / 6 / 8 | 27-36 s, 11 % / 28-50 s, 39 % / 24-53 s, 10 % | 4 / 4 49-72 s 46 % / 4 / 4 56-76 s 55 % / 4 / 4 49-68 s 56 % | 4 / 4, 46 % |
| 11 knot | 0 / 24 / 0 / 24 / 0 / 8 | 57-101 s, 4 % / 62-81 s, 20 % / 55-68 s, 8 % | 3 / 4 154-183 s 36 % / 3 / 4 110-157 s 81 % / 3 / 4 71-96 s 87 % | 4 / 4, 18 % |

**What the numbers say:**
- **Skilled wins every fight with all three teams; mashing with the neutral team stays under a quarter** (at most 3 / 24).
- **Mashing with the Ice team wins the four tangles** (20-24 / 24). That is not the ice: the same Ice team mashes Puddle Meadow's patch 1
  8 / 8 too, and with the ice turned off it mashes lake patch 7 8 / 8. Its kit is many shots and rushes (mashing a big blast only makes a weak
  puff, which is what stops the neutral team), and the lake's birds take its Ice moves x2. The owner's team mashes them too (it did in the
  meadow). Judged as in the meadow: with a type-neutral team (question 1 below).
- **How much the Ice type helps:** a skilled Ice team loses a third to a half of the HP a neutral one does on four of the five patches
  (e.g. patch 8: 19 % vs 46 % a minute, the knot 4 % vs 20 %), and the person bot with the Ice team loses less everywhere (the knot: 36 % vs
  81 % a minute; while tuning, 6 fights each: Ice 6 / 6 won, neutral 4 / 6). Part of that is the type chart (an Ice monster's attacks do half
  to Ice creatures); the grip alone is small (next point).
- **The knot is the region's longest fight** (a person 1.5-3 minutes); the kid bot (sees a warning 0.35 s late, no dodge) never wins it.
- **The grip alone** (the Ice team's kid bot with its grip, and the same bot with the grip taken away for the measurement only): with its grip it loses 70, 68, 56, 52 and 110 % of its HP a minute on patches 7-11, slipping 62, 104, 53, 62 and 101 %
  (8 fights each; it wins every tangle either way and never the knot).
  Small and noisy: at 2 blocks of glide the slide costs little. The arena's Ice Lake (`slide` 0.75) was about four times as slippery.
- **What the ice costs a team that slips:** the neutral person bot loses 52-62 % a minute on the lake's tangles and 0-4 % with the ice
  turned off on three of them (46 % on patch 10, whose Fizzbomb charges anyway), but most of that is the monsters skating at you (on plain
  ground they lob).

### 6. Checks

- `node tests/wobblecheck.mjs`: the meadow as before; the lake's patches cannot be reached before the west wall melts, all can after it,
  nothing in Bumpy Hills or Shadywood can; lake rings 100 % ice, 100 % walkable; the chutes step down one block at a time; the leads are water
  and end at an island; the arrow-following kid reaches all eleven patches (1, 2, 4, 5, 3, 6, then 8, 10, 9, 7, 11).
- `node tests/wobblenode.mjs` (spec part `ice`): the glide (1.9 at 60 and 20 fps, sprint 2.7), an Ice ride 0, a Fire ride 2.3, the meadow 0,
  the chutes to the island with no keys, the lake's floating hill only by its spring, in a fight a Fire creature glides 1.8 and an Ice one 0,
  in the meadow 0, a slipping monster's red line 10.5 vs 9.
- Spec part `lake` (real keys) and `lakeipad` (the joystick): walls, chip, arrow, rows, a glide with skid marks, a chute ride, walking into
  patch 7 starts its fight on the ice (Frostling keeps its grip, the other two slip), a win (key, +3 cubes), freed creatures, a reload, the
  knot with Blizzbear, the lake in colour and the east wall gone. The specs `jump` and `water` (the player) and `scribble` part `bots` (the main
  world's test patch) are green: nothing changed off the lake.

### 7. Questions for the owner (Slippy Lake)

1. **An Ice team can win the lake's tangles by mashing** (as your own team can in Puddle Meadow). Is that fine (the right team for the place
   should have it easy), or should mashing lose with every team? That would be a change to the fight everywhere, not only on the lake.
2. **How slippery?** The glide is the decided "about 2 blocks", and the grip only helps a little at that. Should the lake be more slippery
   (the arena's ice was about four times as slippery, and there an Ice creature had a big advantage)?
3. **Slipping monsters skate at you** (they all charge on the ice). Good, or should they keep their own way of fighting?
4. The lake's monsters are **one Ice monster per patch plus ducks and birds**, not mostly Water (so an Ice team is not slowed down by the type
   chart). OK?
5. The meadow's knot now opens **only the lake**, not all three walls; Shadywood opens after the lake. OK?
6. Next: **Shadywood** (the dark) with the same kind of ground rule?

### 8. The owner's look at Slippy Lake (2026-11-11, late) and what changed

**The owner:** the ice was not greyed enough; it was "just pure ice" ("a bit more integrated with other types of blocks, naturally, though
ice still dominant"); it "felt much smaller than the meadow"; "why do scribbles not appear at all until I get close"; question 1 and 3 were not
clear; question 2: **"yes more slippery. more fun"**; question 4: either is fine; questions 5 / 6: **"all regions should be visible / walkable,
one region shouldn't be the dependency for another region to unlock"**, build them one by one, Shadywood next in another session.

**Changed (all ?preview; sections 1-6 above are the first build, these replace them where they differ):**
- **No walls, every region open** (`src/wobbleland.js`: `WALLS`, `regionOpen`, `meltWall` and the Scribble's wall are gone). Every patch of
  every region can be fought from the start; a region's knot still comes only after its own other patches (`openPatches`). A region still
  being drawn (Shadywood, Bumpy Hills) is walkable grey land and says "still being drawn" once when you walk in. Example: from the Camp walk
  west and you are on the lake; the arrow shows the meadow's two smudges first, then the nearest tangle of any region.
- **The lake is as big as the meadow:** it now reaches north to z 72 (`LAKE_Z0`; two lobes, `LAKE.lobes`), 9 238 walkable cells against the
  meadow's 9 059 (`tests/wobblecheck.mjs`); it was 60 % of the meadow. **Seven patches:** six tangles (two new, 12 and 13, in the north lobe,
  13 with a hole of open water) and the knot, moved to the far north end (29, 99) so you meet the tangles on the way. Patch 12 is Snowpaw,
  Gullop, Zeppeluff (with Kiteling the neutral team mashed it 9 / 24).
- **Not only ice** (`LAKE.drift`, `LOGS`, `ROCKS`, `PINES`): snow drifts on the ice (about one cell in six; you keep your grip on them, so a
  drift in a fight ring is a place where you can stop), logs frozen into the ice, rocks poking up through it with a snow cap (never in a
  ring: they would block shots and steps), a rock island in the middle, snowy pines and gravel on the shore. Rings stay 80-96 % ice
  (`wobblecheck.mjs` asks at least 75 %); the drift threshold is `LAKE.drift` 0.72 (0.62 made a third of the rings snow).
- **Greyer ice under the Scribble** (`WOBBLE_FRAG` in `src/caves.js`, `wobIce`): the Scribble's grey with only a cool hint and a faint shine
  (it was a pale blue). Coloured in, it is still the bright ice blue.
- **More slippery** (`Ice` in `src/groundrules.js` line 27): letting go eases at `k` 1.1 (was 2.15): from a walk you glide **3.6-3.8 blocks**
  (a sprint 5.2, a Fire ride 4.4; 60 = 20 fps, `tests/wobblenode.mjs`); getting going and turning eases at `go` 0.7 (was 1.0); a slipping
  monster's charge goes 2 past its aim (was 1.5).
- **Every patch is drawn from afar** (`syncFar` in `src/scribble.js`): until now only the live patch (the nearest one you had not cleared,
  and it changed only when another was 8 blocks nearer) had its tangle and grey ground; the rest of the lake looked empty. Now every open
  patch shows its boiling pencil tangle and the scribble on the ground; its monsters come out when it becomes the live one. Each is a group
  at the patch's middle, so the curling page lifts it like any far model. Cost: 2 draw calls a patch.

**What the questions meant, in plain words, and what I decided:**
- *Question 1 ("mashing"):* "mashing" is a child pressing the attack buttons over and over without moving out of the red warnings. The house
  rule says that must not win. It does lose with a type-neutral team on every lake patch (at most 3 / 24 fights), but **an Ice team wins the
  lake's tangles that way** (21-24 / 24), and so does your own team (3-7 / 8) and the Ice team in Puddle Meadow too. The reason is not the ice:
  teams whose moves are many shots and rushes simply hit hard enough; the neutral team relies on big blasts, and a mashed big blast is a weak
  puff. **Decided for now:** judged as in the meadow (with the neutral team); fixing it means changing the fight everywhere (e.g. monsters that
  punish standing still), which is question 1 below.
- *Question 3 ("skate at you"):* on the ice, every monster that is not an Ice monster runs straight at you instead of throwing things from a
  distance, slides past you and skids on (its red line is longer). **Decided: kept**: it is the one thing that makes the monsters' slide visible
  (without it every lake monster threw things from afar and the ice changed nothing about them).

**Bot numbers after the change** (`node tests/wobblebots.mjs`, every lake patch, 60 and 20 fps; "loses" = % of the squad's HP a minute;
mashing 12 fights a frame rate, the owner's 4; skilled and person 2 each):

| Patch | Mashing won: neutral / Ice / owner | Skilled (all won): Ice / neutral / owner | Person won: Ice / neutral / owner | Neutral person, ice off |
| --- | --- | --- | --- | --- |
| 7 tangle | 3 / 24, 24 / 24, 6 / 8 | 21-66 s 16 % / 28-37 s 58 % / 31-43 s 11 % | 4 / 4 (48-77 s, 40 %) / 4 / 4 (81-115 s, 48 %) / 4 / 4 (42-57 s, 53 %) | 4 / 4, 3 % |
| 8 tangle | 1 / 24, 24 / 24, 4 / 8 | 25-51 s 16 % / 31-53 s 58 % / 23-43 s 30 % | 4 / 4 (63-77 s, 52 %) / 4 / 4 (65-94 s, 57 %) / 4 / 4 (49-73 s, 42 %) | 4 / 4, 4 % |
| 9 tangle, holes | 0 / 24, 21 / 24, 5 / 8 | 46-55 s 4 % / 46-51 s 35 % / 32-51 s 27 % | 4 / 4 (116-139 s, 37 %) / 2 / 4 (88-101 s, 79 %) / 3 / 4 (47-85 s, 77 %) | 4 / 4, 0 % |
| 10 tangle | 0 / 24, 24 / 24, 3 / 8 | 26-37 s 0 % / 31-38 s 38 % / 32-43 s 14 % | 4 / 4 (51-70 s, 43 %) / 4 / 4 (58-79 s, 62 %) / 4 / 4 (45-60 s, 48 %) | 3 / 4, 63 % |
| 12 tangle (new) | 0 / 24, 23 / 24, 5 / 8 | 30-48 s 22 % / 37-50 s 75 % / 26-40 s 47 % | 4 / 4 (64-88 s, 43 %) / 2 / 4 (94-110 s, 91 %) / 4 / 4 (44-70 s, 58 %) | 4 / 4, 0 % |
| 13 tangle (new), hole | 0 / 24, 24 / 24, 6 / 8 | 32-39 s 10 % / 38-45 s 25 % / 19-40 s 33 % | 4 / 4 (72-105 s, 35 %) / 3 / 4 (59-92 s, 85 %) / 4 / 4 (40-64 s, 67 %) | 4 / 4, 3 % |
| 11 knot | 0 / 24, 2 / 24, 0 / 8 | 50-62 s 7 % / 66-77 s 39 % / 40-53 s 26 % | 4 / 4 (158-188 s, 21 %) / 3 / 4 (121-154 s, 62 %) / 2 / 4 (64-99 s, 79 %) | 4 / 4, 5 % |

**The fitting type now shows:** the person bot with the Ice team won **28 / 28** lake fights, with the neutral team 21 / 28 and with your
team 25 / 28; a skilled Ice team loses a third or less of what a neutral one does on every patch. With the ice off, the same neutral person
loses almost nothing, so on the lake it is the ice (and the monsters skating at you) that hurts a team that slips. **The grip alone** (the
Ice team's kid bot, with its grip and with the grip taken away for the measurement) is still noisy: it loses 47 / 91 / 43 / 58 / 70 / 45 / 47
% a minute with its grip and 52 / 76 / 64 / 55 / 59 / 53 / 35 % slipping (patches 7, 8, 9, 10, 12, 13, 11).

**Questions for the owner (after this change)**
1. **Mashing with a strong team:** a child who only presses the buttons and never moves wins the lake's tangles with an Ice team (and with
   your team), the same as on Puddle Meadow's first patches. Should mashing lose with every team? That is a change to the fight everywhere.
2. **Is it slippery enough now** (about 4 blocks of glide from a walk, 5 from a sprint)?
3. The drifts, logs, rocks and pines: enough "other blocks", or more (e.g. a frozen reed bed, a half-sunk boat)?

## Shadywood: the plan (the next session builds it)

The same pattern as Slippy Lake: one ground rule, one type a child sees winning, ways to move with no button, patches whose monsters fit
the place. Everything behind ?preview; no walls (every region open, owner 2026-11-11).

- **Where:** east of the meadow (`regionAt` 'wood': x 163..223, z 134..223, `WOOD` today: rows of plain trees), grown north into the hills'
  strip like the lake (about the meadow's size, ~9 000 walkable cells), so Bumpy Hills keeps the whole north.
- **The ground rule:** a `Dark` subclass of `GroundRule` (`src/groundrules.js`) with `sight(type)`: under the trees you see only near your
  creature's light (the arena's `SEE`: near 4.6, far 7.5); `world.groundAt` answers it where the canopy is closed (a top-block test like
  `iceUnder`: leaves over you). **Fire, Light, Electric and Cosmic creatures glow: their circle of light is twice as big** (you see the red
  warnings sooner); a big blast lights the whole ring for a moment. In the fight: `ScribbleFight` asks `rule.sight` for what the camera and
  the warnings show (warnings outside your light are drawn only as a faint glow), never for the sums. On foot: the WOBBLE shader darkens by
  distance from you (a lantern circle), so the dark is the same look in and out of fights.
- **The look:** tall crayon trees with a closed canopy, shafts of light in clearings (lit, no rule there), glowing mushrooms, fireflies,
  eyes in the dark that are only scribble bugs; under the Scribble greyer and darker.
- **Ways to move with no button:** glowing mushroom caps you bounce on (Bounce Blocks with a drawn cap, like the springs), a dark river with a
  current between clearings (`flowAt`, as the lake's leads), hollow logs you slide through.
- **Patches:** 6 tangles + a knot (Ghost, Ninja, Grass, Bug monsters; one glowing monster per patch so the light rule shows on their side
  too), the knot's big one a Ghost Grumble; freed creatures near their patch and in the clearings.
- **Bots:** the same `runLake`-style table with three teams (a glowing team: Fire / Light / Electric / Cosmic, the neutral one, the owner's),
  mashing judged with the neutral team, skilled must win with all, the person bot's wins and HP loss as the "how much the type helps" number;
  the iPad matters most here (the dark must stay readable on a small screen).
- **Open question to settle first:** how dark is fun for a child and still readable on the iPad (try two levels in screenshots).

## 0. The owner's decisions (2026-11-11)

| Question | Decision |
| --- | --- |
| The way in | **Under the Wizard's tower** (his first world) |
| Who gets in | **Only the Wizard's Ally** (under `?preview` too: the owner tests with an Ally save; see step 2) |
| The look | **More different from our world: almost distorted, but cheerful, never gloomy or dystopian. Different from the Swirl too** (section 2) |
| Freed creatures | **Catchable** |
| Flags | **+10 % attack for the flown type's creatures, in every battle** (scribble, regular, duels); defence / speed maybe later |
| Battles | Turn-based stays as it is; heal stays 45 %. **Every move gets its live kind by its nature (data), not from its power**; each kind has its own advantages and disadvantages (wait, hit strength, risk); level and power count; kinds well spread over the creatures (section 7). The night run (2026-11-11) decides the kind list and the numbers itself and writes them in "Decided overnight"; the owner may change them in the morning |
| First slice | **5 patches + a big knot** |
| Names | Claude's names below, for now |
| The ring | **Radius 10 stays** |
| Places and types | The arena's twists and type advantages **belong in the plan** (section 6); the owner is open to more ideas, since ground alone can't cover 47 types |

### Names

- The world: **Wobbleland**, the Wizard's very first drawing, from before he learned to draw straight. (It explains the look in one word.)
- The way in: **the Paper Door**, a crumpled-paper door at the foot of his tower.
- The hub: **Inkpot Camp**, a small bright clearing where you arrive.
- The regions: **Puddle Meadow** (first), **Bumpy Hills**, **Slippy Lake**, **Shadywood**, and in the middle **the Big Knot**.
- The patches by size: **smudge** (small), **tangle** (medium), **knot** (big, with a big one inside).
- The big one in a knot: **a Grumble** (a big creature the Scribble has wound up extra grumpy).
- The flags' book: **the Flag Book** (a tab in the Book, next to Badges and Stars).

---

## 1. The story hook (decided: under his tower)

At the end of chapter 2 the Wizard is out on his island and says *"Something scribbly is still out there... I will need your help
again."* (`studio.js` `END`). Chapter 3 picks it up:

Before our world, the Wizard drew a first one: **Wobbleland**. He was still learning: the trees lean, the hills bulge and the colours came
out a bit wrong. On it he drew a creature he didn't like, scribbled it out and shut the whole page away under his tower. When the Swirl
cracked, the Scribble woke up there, and now it scribbles over everything.

- **The Paper Door** stands beside the tower door on his island, drawn only for the Ally (a grey-and-cream `DoorGlow` from `portal.js`,
  `tint`). The Wizard stands next to it. First talk: *"The Scribble is in my very first drawing. Let's colour it back in!"*
- Realm `REALMS.wobble` (`parent: 'swirl'`, an entrance like the tower's, `lose: 'stay'`), arriving at Inkpot Camp; the way back is the
  stair up to his island.
- Later (section 5) scribbles leak into our world and the Picture Worlds: the reason to go back. Wobbleland is reached only from the island.

## 2. The world: size, places, look, how the Scribble shows

### Size

**224 x 224** (like Playland, Cube Planets and the Pirate Seas): room for the Camp, four regions and the centre with about 30 patches;
realm loading and draw calls are already measured at that size. 160 x 160 holds only about 10 patches with a 20-block ring and room
between them; 288 x 288 and larger is slow to generate, mostly empty and heavy for the iPad. Terrain in a new `wobbleland.js`
(Node-runnable, like every Picture World), so travel, saves, follow-the-host, resting after a loss and the way back come for free.

### Places (the whole chapter; the first slice builds only Inkpot Camp and Puddle Meadow)

A ring of regions round a centre, each a different ground to fight on (`plans/chapter3.md` section 5: "the terrain is the arena"):

1. **Puddle Meadow**: soft bulgy hills, leaning trees as cover, big puddles. Teaches the fight.
2. **Bumpy Hills**: high ground and drops; stomps reach only their own height, so standing high matters.
3. **Slippy Lake**: ice, everyone slides.
4. **Shadywood**: dark; you see only near your light.
5. **The Big Knot** (centre): a huge tangle; the end of the chapter.

**Inkpot Camp** sits at one edge: a small, fully coloured clearing with the stair up, the Wizard, a healer (`world.healer`) and later his
workshop. Regions open one after another: the way into the next is a scribble wall (a keep while it stands, like the Bubble Well's) that
melts once the region's knot is cleared.

### The look (decided: more different, almost distorted, cheerful; not like the Swirl)

What the Swirl already is, so Wobbleland is NOT it: a purple pastel sky, floating platforms and loops, zone moods. Wobbleland is **one
solid sunny land on the ground, drawn by a beginner**. Three options, which can be combined:

| | Option | What you see | Cost / risk |
| --- | --- | --- | --- |
| A | **Wonky shapes, as terrain data** | trees that lean or corkscrew, mushroom-shaped hills, a giant flower taller than a house, a river with right-angle zigzags, a cloud stuck to a hilltop, a house drawn too small with a huge door, stairs to nowhere | none for the renderer: it is all blocks (physics and fights work as usual) |
| B | **The page curls up, drawing only** | the land bends gently upward with distance, like a sheet of paper curling at its edges: the horizon rises behind everything (the opposite of a planet). Near you the ground is flat, so walking, aiming and the fight camera are unchanged | one vertex-shader line in the shared block and model shaders under a material define set only in this realm (like `SKETCH`); models far away must bend the same way; must never wobble over time (motion sickness) |
| C | **A first-draft palette** | colours a beginner would pick: lemon grass, mint trees, pink water, a striped sky, chunky outlines on block edges | a tint step in the shader (the Swirl's `swirlTint` is the precedent) |

**Rec. A + B + C together:** A makes the land itself odd, B makes it feel like a drawing you are inside, C makes it bright. **The
Scribble on top:** scribbled regions have the colour drained to grey with scribble strokes on the faces; **a cleared patch floods the
first-draft colours back** in a circle that grows over about 2 s. Technique: a small colour texture over the map (one texel per 4 x 4
blocks) read by the block shader only under this realm's define; a spec proves the main world, the Dream, the Swirl and every Picture
World render bit for bit the same (as the Sketchbook's spec does). Player-built blocks keep their own colours.

If B makes anyone dizzy on the iPad (to be tried in step 4), it is turned off and A + C carry the look.

### How the Scribble shows

- **From the Camp:** the Scribble itself, a huge angry tangle hanging over the Big Knot, slowly churning (one instanced mesh, like the
  patch tangle), always on the skyline.
- **Patches:** the existing tangle + ground decal, sized by how many monsters wait inside (smudge, tangle, knot).
- **A region:** grey, with coloured circles where you already won.
- Now and then a scribble line zips across the ground toward a patch (the Scribble feeding it). Only a look.

## 3. Scribbled patches

### How many

About 6 per region, the last one a knot (about 30 in the chapter). **The first slice: Puddle Meadow's 5 patches + its knot.**

### How they get harder (never by plain numbers alone: the masher must keep losing)

| | Lever | Rule |
| --- | --- | --- |
| 1 | **Size you can see** | smudge 2 monsters, tangle 3-4, knot 4-5 + a Grumble (the patch's size says it before you step in) |
| 2 | **Patterns** | smudges only charge; tangles mix charge + lob; knots add stomps, and then two warnings at once |
| 3 | **The ground** | each region's twist (section 6) |
| 4 | **Types** | a patch holds creatures of its region's types: a team that beats them has an easier time (a reason to catch, section 5) |
| 5 | **Levels** | today the monsters take your strongest creature's level (the fix that stopped mashing with a mixed team). Keep that, with a small step by size: smudge -3, tangle 0, knot +2 |
| 6 | **The Grumble** (knots only) | a big monster with a weak spot: full damage only from behind or right after its own attack. A new pattern in `scribblefight.js` |

Monsters stop being the arena's fixed `FOES` list: each patch names its species, and a pure rule gives a species its fight pattern
(`patternOf(species)`, from its moves' kinds via `movekinds.js`: rushers charge, heavy Rock / Metal / Bone bodies stomp, the rest lob).
Patch data lives in `wobbleland.js` as plain records (`{ id, x, z, size, species: [...] }`, append-only ids). Puddle Meadow's monsters:
meadow types (Grass, Bug, Water, Normal, Sky), so a Fire or Electric creature has an easier time with some of them.

### What clearing one does (decided: freed creatures are catchable)

- The scribble bursts off, colour floods back, the freed creatures' colours come back and they hop away (all already built for the test
  patch). **They then live there as wild creatures you can catch** (a normal turn-based battle, `creatures.js`): Wobbleland's spawn table
  grows with every cleared patch (a spawn condition `freed:<patch>`, like the Picture Worlds' `afterOk`).
- **+3 Capture Cubes** the first time; the region's meter goes up (`🎨 Puddle Meadow 3 / 6`, a score chip).
- **The knot** gives the region's flags (section 5) and opens the next region.
- Saved: one key per patch, `pw:wobble:patch<id>` in `beaten` (the Picture World key form, which `loadKeys` already keeps); a realm
  `version`. A cleared patch stays cleared (the test patch's "scribbles itself back after 20 s" stays only in the main-world test).
- A lost fight: your squad rests at the Camp (`realms.lost()`); the patch stays; nothing is lost.
- Later: a cleared patch can be fought again just for fun (`ForFun`), saving nothing.

## 4. The goal and the loop, and the end of the first slice

**One look:** the land is grey; tangles sit around you; the Camp behind you is in colour. **One line** (the first time only): *"Grey
means the Scribble. Win, and the colour comes back!"*

**The loop:**
1. The guide arrow points to the nearest patch (realm `aim`, and patches as rows in "Where to go": the test patch already has one,
   `destinations.js`, 2026-11-10; it grows into one row per uncleared patch).
2. You see its size. Walk in when ready.
3. Fight (the fight as it is now).
4. Win: colour floods out, the freed creatures hop away, the meter ticks.
5. Lost: a rest, then try again or try another patch first.
6. Between fights: catch a freed creature, heal at the Camp, change your team.

**Hard to master:** the timed rush and the full big blast, using the ground (high spots, trees as cover, the twists), picking a team for a
patch's types, the Grumble's weak spot.

**The end of the first slice:** Puddle Meadow's knot. Clear it and the whole region floods with colour, the wall to Bumpy Hills melts,
the Wizard says *"Puddle Meadow is bright again! Next: Bumpy Hills."*, and the region's flags fly over the Camp. Bumpy Hills is a "Coming
soon" sign (like Playland's empty zones). That is the test for the owner and son: is the loop fun for six fights in a row?

## 5. Reasons to go back to the old world, and how the two connect

- **Catch counters:** each patch's types are shown on its sign (linked to the Book); our world and the Picture Worlds are where you catch
  the types that beat them.
- **Leaks:** after Puddle Meadow, small scribble patches appear near gyms in our world (the leader: *"A scribble near my gym! Help!"*) and
  in the Picture Worlds. The guide and "Where to go" point to them, so nothing is hidden (the owner's worry was hiding flags in the old world).
- **Flags are won by clearing scribbles:** Wobbleland's knots give the flags of their region's types; a leak near a gym gives that gym's
  type flag; a leak in a Picture World gives its type's. 46 flags (Custom has none). One flown at a time, chosen in the Flag Book; flown
  over the Camp (later over your home too).
- **How the worlds connect:** our world -> Portal Door -> the Swirl -> the Wizard's island -> the Paper Door -> Inkpot Camp, and back
  the same way. No new shortcut in the first slice; later perhaps a "paper plane" home from any cleared region.
- **Flags are not in the first slice:** they need section 7 first.

## 6. Places and types that change a fight (yes, part of the plan)

The arena showed it works (`src/arena/core.js` `PLACES`, `SEE`): the Dark Cave and the Ice Lake felt different, and a type that fits
the place had a real advantage. In this world **the real ground decides it**, never a mode switch, and each twist gets **one type
advantage a child can see** (the creature glows, doesn't slip, swims fast). The same rules then work for leaks in our world (a patch in
the snow is slippery, one in a cave is dark).

| Ground | Where | Twist | Who has the advantage (and how it shows) |
| --- | --- | --- | --- |
| Puddles / water | Puddle Meadow, rivers | everyone swims slowly (built: `FIGHT.water` 0.6) | **Water** creatures swim at full speed (a splashy wake) |
| High ground | Bumpy Hills | a stomp reaches only its own height (built); a step of two is a wall (built) | **Sky** and **Drake** creatures hop a two-block step (they flap) |
| Ice | Slippy Lake, snow leaks | everyone slides about 2 blocks after letting go, monsters overshoot (arena: `slide` 0.75, `attack` 0.6) | **Ice** creatures keep their grip (no slide trail) |
| Dark | Shadywood, cave leaks | you see only near your light (arena `SEE`: near 4.6, far 7.5); blasts light it up | **Fire, Light, Electric, Cosmic** see further (their glow is bigger) |
| Tall grass (later) | Puddle Meadow's edges | shots lose sight of a creature standing in it | **Grass** and **Camo** creatures hide in it (half-faded) |

**Beyond the ground (owner: "you'll probably run out of ground ideas because we have so many creature types"):** the ground gives an
edge to about ten types. Two more sources, for later and only if the first slice is fun:
- **Time and weather in Wobbleland** (the main world already has both): at night Ghost, Ninja and Dream creatures are harder to see; in
  rain Water moves splash wider. Each a one-look rule.
- **A small fight trait per type** (one each, shown in the Book): e.g. Fire leaves a short burning patch where its shot lands, Electric
  shots jump to a second monster close by, Ghost shots fly through one block, Metal takes less from stomps, Bubble creatures float over
  water. 47 small traits is a lot of tuning, so only a few at a time, each measured with the bots.
Meanwhile every type already has its edge in the type chart, in both battles.

The monsters follow the same rules (an Ice monster on ice doesn't slide; a Water monster swims fast), so the patch's types and the place
together decide which team does best. Bots measure every twist: the naive bot still loses, the skilled bot still wins with any team, and
the fitting type helps visibly (a per-twist table like `plans/chapter3.md` section 9).

## 7. Moves in the live fight (owner 2026-11-11)

### What is wrong today

A move's live kind is **worked out from its numbers** (`movekinds.js` `kindOfMove`): power 80 or more = big blast, priority or recoil =
rush, `multi` = many shots, the rest = shot. So a move's kind is not what the move *is*: any strong move becomes a big blast, and a
guardian or later move built up past 80 would change kind. Owner: "pretty silly". Counted on 2026-11-11 (all 367 moves): 239 attack
moves = **95 shots, 86 big blasts, 29 rushes, 29 many shots**; **36 of the 47 types have no move of at least one attack kind** (e.g.
Water, Electric, Rock, Ice: no many shots and no rush; Mind and Pixie: only shots).

### The owner's rules (decided)

1. **Every move has its kind by its nature, as data**, the same move in turn-based and live battles: e.g. a slam or charge is a rush, a
   wave or quake a big blast, a spit or bolt a shot, a flurry or swarm many shots. Turn-based battles keep their own rules (the kind is
   only for the live fight and the move's look); the live fight has its own mechanics on top.
2. **The kind gives each attack its own advantages and disadvantages:**

   | Kind | Advantage | Disadvantage |
   | --- | --- | --- |
   | **Shot** | safe: from a distance | one target, a hill or tree stops it |
   | **Many shots** | safe, and easy to land some | hard to land them all |
   | **Rush** | (a big hit up close; the timed rush stops a monster's attack, built) | the riskiest: you run in |
   | **Big blast** | covers the most ground (hits several) | risky and needs skill (hold to charge, stand close) |

   The kind sets the wait between uses and how hard each hit lands, so that no kind is simply best.
3. **The creature's level counts** (it already does: the damage sum, the same as turn-based).
4. **The move's power counts** (it already does per hit; with kinds by nature, a strong shot and a weak shot are both shots, so a higher
   number is simply a harder hit of the same kind).
5. **Attack kinds well spread over the creatures**, so fights use all sorts of attacks.

Heal stays 45 % (owner: fine, it grows with HP). Turn-based battles do not change at all.

### How the build session does it

1. **A kind for every attack move, by its nature:** a data table in `movekinds.js` (`MOVE_KIND = { moveId: 'bolt' | 'volley' | 'burst' |
   'dash' }`, every damaging move listed; `kindOfMove` reads it; a Node check fails on a damaging move without one). Help moves keep their
   kinds from their effect (heal, sleep, power up / Tough, cloud), which are already by nature. Chosen from each move's name and idea,
   **listed by type in "Decided overnight"** (the owner may change any in the morning: one line each in `MOVE_KIND`). Nothing saved changes: the
   Wizard's Attacks tab (designed looks, keyed by move id) reads the same `kindOfMove`, so a move whose kind changes shows that kind's look
   choices.
2. **The spread:** the same script counts, per type and per creature (its learnable attack moves), which kinds it has. Goal: every type has
   all four kinds among its moves, and most creatures can learn at least two kinds. First by choosing kinds well (a move's nature often
   allows two readings); where a type still lacks a kind, the list names it and the owner decides whether it gets a new move (a new move
   needs data, `fxrecipes.js` effects and a sound; turn-based battles get it too). The night run adds no new moves: it picks the best reading
   of an existing move and lists any gap.
3. **Wait and hit strength per kind:** one number pair per kind (wait, hit factor) on top of the same damage sum, plus the kind's own
   rules (the rush's window, the blast's charge and area, the volley's spread). Set with the bots: each kind alone with the same creature and
   power must be worth about the same to a skilled player in its own situation; the masher must still lose; a person about 1-1.5 minutes.
   The table (in plain words, with an example) goes in "Decided overnight"; the numbers sit in one place per kind, easy to change.
4. **Speed counts (owner 2026-11-11: "absolutely")**: today the live fight ignores the speed stat and turns speed-raising moves into an
   attack boost. Now the speed stat sets how fast a creature walks and dodges (a narrow band, set with the bots, so no creature is
   hopeless), and the 14 speed-raising moves become their own Special, **Speed up** (its own icon and word on the button; faster for a
   while), no longer an attack boost. Monsters follow the same speed rule.

### Flags (decided: +10 % attack, every battle)

A flag gives your creatures of its type **+10 % attack**: every hit they make does about 10 % more, in turn-based battles, duels and
scribble fights alike. In a long live fight that shows up smoothly (a fight about 10 % shorter); in a short turn-based battle it shows only
when it tips a creature over one hit sooner. (My earlier line that a flag "would count more" in live fights was misleading: it is the same
10 % per hit; the live fight just has more hits for it to add up over.) Gym trainers and wild creatures never fly flags. In duels both
players' flags count, so the duel `VERSION` goes 14 -> 15. Defence or speed flags can come later.

## 8. What the fight needs changed (only inside `scribblefight.js` / `scribble.js`)

1. **Many patches from data:** `createScribble` takes a list (`world.patches` in Wobbleland; the main world keeps its single test patch
   until the owner drops it). Only patches within about 60 blocks are drawn (draw calls on the iPad).
2. **Monsters from the patch:** `opts.foes` already exists; add `patternOf(species)` (pure) and the size rule (count, level step).
3. **Saved results:** a won patch sets its key and stays coloured.
4. **The ground's twists and type advantages** (section 6) as properties of `groundOf(world)` (`slick(x, z)`, `dark`, `wet`, `grass`),
   ported from the arena's `PLACES` / `SEE` (the arena itself stays untouched).
5. **The Grumble:** a pattern with a weak spot shown on the creature (a glowing back), not in words.
6. **Up to 6 monsters at once:** spawn spots (`spotAround`), warnings never stacking unreadably, the mashing check again (since
   2026-11-10's `FIGHT.firstJitter` mashing wins about 1 fight in 10 at both 60 and 20 fps; more monsters must keep it under a quarter).
7. **Patch spots placed by hand in the terrain** (flat enough, no water inside the ring unless it is a water twist) and checked in Node,
   instead of `scribbleSpot`'s search.
8. **Hooks out:** `onWin(patch)` / `onLose(patch)` for the colour flood, the chip, the freed creatures and keys.
9. **Moves** (section 7): kinds by nature, wait and hit strength per kind (steps 1 and 1b).

The ring stays radius 10. The arena (`arena.html`, `src/arena/`) stays untouched.

## 9. Later pieces (outline only)

- **The Wizard beside you:** from Bumpy Hills on he walks into a fight with you: his creature is a fourth fighter on your side. Later
  his **big spell**: herd the monsters into his glowing circle and it bursts (a positioning skill, not a button).
- **Eggs:** from Bumpy Hills on, a Grumble doesn't hop away: the Wizard turns it back into an egg (`STORY.md`). Carried in a team slot,
  hatched by walking; some only hatch with a friend nearby.
- **The Wizard's workshop** at Inkpot Camp: cleared patches leave paint drops (never star-shaped); paint + blocks make Capture Cubes,
  Wobbleland's wonky coloured blocks to build with at home, later potions (mixing; `wizardtower.js` `mixPaint` is a start).
- **Friends:** a friend follows you in (realms together, T38b) and fights in the same ring (both browsers must agree on the fight; later).
- **The ending:** at the Big Knot you help the Wizard **finish drawing the Scribble** (his drawing board again), and it becomes a friend.

## 10. Build order (each step behind `?preview`; each with naive / skilled bots, real keys through the game's loop and an iPad run; the `scribble` spec grows parts, e.g. `SCRIBBLE_ONLY=numbers|land|door|patches|look|loop|knot`; steps 1 and 1b come before the world)

1. **Move kinds by nature** (section 7): the `MOVE_KIND` table and the spread count, listed by type in "Decided overnight"; no stop
   (the owner checks it in the morning).
1b. **Wait and hit strength per kind** (section 7): set with the bots, inside `scribblefight.js` / `movekinds.js`; mashing under a quarter,
   skilled wins all, the person bot about 1-1.5 minutes; speed counts (section 7 point 4: the stat in a
   narrow band, the Speed up Special); the table and the speed band go in "Decided overnight".
2. **Wobbleland as data** (`wobbleland.js`, Node-runnable): Inkpot Camp, Puddle Meadow with its wonky shapes, the wall, the six patch
   spots, the way back. Node checks: every patch reachable on foot from the Camp, every ring 75 %+ walkable, no patch inside another, the
   wall really closes Bumpy Hills. No fight yet.
3. **The Paper Door:** drawn for the Ally only, `REALMS.wobble`, arrive at the Camp, the way back, save / reload in the realm,
   follow-the-host. Spec: a save without `ally` sees no door; a test save with `wizard.ally` walks in and out with real keys.
4. **The look:** the first-draft palette, the curl (behind one on/off switch; the iPad's frame rate checked as far as possible here), grey regions and the colour flood; the spec proves every
   other world bit for bit; screenshots; draw calls and frame time.
5. **Patches from data in the fight:** `patternOf`, sizes, levels; the water twist with its Water advantage; bots on every patch at 60 and
   20 fps (mashing under a quarter over 12 fights a patch, skilled wins all, the person bot about 1-1.5 minutes); keys saved and reloaded.
6. **The loop:** guide arrow and "Where to go" rows, the meter chip, freed creatures catchable, +3 cubes, the Camp's healer, the Wizard's
   lines. A naive kid bot that only follows the arrow must reach every patch.
7. **The knot and its Grumble:** the weak-spot pattern (mashing it from the front must fail), the region flooding with colour, the wall
   melting, the Wizard's words. **End of the first slice: the owner and son play it.**
8. **After their verdict:** flags (the Flag Book, +10 % attack in every battle, duel `VERSION` 15), leaks near gyms, then Bumpy Hills with the Wizard beside you, Slippy Lake and Shadywood with their twists.

---

## Questions for the owner (before the night run)

Answered 2026-11-11: the look as described, flags +10 % attack, names kept for now, heal stays 45 %, moves get their kind by nature with
advantages and disadvantages per kind (section 7).

Still open (the night run decides each and writes it in "Decided overnight"; the owner may change it in the morning):
1. The kind list by type (step 1): any moves to move to another kind, and does any type need a new move to have all four kinds?
2. The numbers per kind (step 1b) and how much speed changes.
3. The look, when step 4 shows it (and whether the curling horizon stays).
