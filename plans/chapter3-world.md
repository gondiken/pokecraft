# Chapter 3's new world: a plan (2026-11-10 / 11, planning only, nothing built)

Built around the scribble fight that already works (`src/scribble.js`, `src/scribblefight.js`, `plans/chapter3.md` sections 7-10:
the camera rising from your eyes, the ring on the real ground, Dodge + two buttons with drawn kind icons, mashing loses, a person
wins in about 1-1.5 minutes). **The build goes in a new session**; this file is what that session starts from (read it after
`plans/chapter3.md`).

House rules that shape every choice: **easy to understand, hard to master** (a child gets it in one look + at most one short line; the
obvious shortcut never wins; naive bot fails, skilled bot wins, real keys, iPad); no Pokémon names; short, friendly text; reuse what
exists (realms, the Picture World kit, the guide, the fight); everything behind `?preview` until the owner opens it.

## 0. The owner's decisions (2026-11-11)

| Question | Decision |
| --- | --- |
| The way in | **Under the Wizard's tower** (his first world) |
| Who gets in | **Only the Wizard's Ally** (under `?preview` too: the owner tests with an Ally save; see step 2) |
| The look | **More different from our world: almost distorted, but cheerful, never gloomy or dystopian. Different from the Swirl too** (section 2) |
| Freed creatures | **Catchable** |
| Flags | **Count in every battle, scribble and regular, with the same impact in both**, which means first making both battles read the same numbers (section 7) |
| Battles | The turn-based mechanics are good today. Open: how level, move power and the help moves carry over between the two, and whether a flag would count the same in both (answered in section 7) |
| First slice | **5 patches + a big knot** |
| Names | Claude names them (below) |
| The ring | **Radius 10 stays** |
| Places and types | The arena's twists (dark cave, slippery ice) and the type advantages (Fire sees further in the dark, Ice never slips) **belong in the plan** (section 6) |

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

The monsters follow the same rules (an Ice monster on ice doesn't slide; a Water monster swims fast), so the patch's types and the place
together decide which team does best. Bots measure every twist: the naive bot still loses, the skilled bot still wins with any team, and
the fitting type helps visibly (a per-twist table like `plans/chapter3.md` section 9).

## 7. One set of numbers for both battles (decided: flags count everywhere, the same in both)

### What is true today (read in the code, 2026-11-11)

| | Turn-based (`battle.js`) | Scribble fight (`scribblefight.js` + `arena/`) |
| --- | --- | --- |
| Damage sum | level, attack / defence, power, same-type x1.5, type chart; plus a critical hit and a random roll | **the same sum** (`arena/core.js` `damage`), no critical hit or roll |
| HP | from level and the species' stats | the same for your creatures; monsters x8 |
| Move power | every move costs one turn, so a 100 move does 1.67 x a 60 move each turn | within one kind it is the same 1.67 x. **But each kind has its own wait** (`LIVE.cool`: shot 0.65 s, many shots 1.6, rush 2.0, big blast 3.2), whatever its power. So a 60 shot does about 92 power a second and a 100 rush about 50: **across kinds, power doesn't decide which is better** |
| Accuracy | a move can miss | no misses; you aim and the monster can dodge out of the way |
| Speed stat | who goes first, the run chance | **not used** (everyone walks 4.6 blocks a second) |
| Heal | the move's own amount (e.g. half your HP) | **always 45 %**, whatever the move says (and you sit 0.8 s) |
| Sleep | 2-3 turns, a sleeper takes x1.25 | **always 2.6 s**, whatever the move says |
| Power up / Tough | stat steps that stack | x1.5 attack until hit / a brace, then x1.3 defence for 8 s |
| Level and help moves | a heal or power up doesn't grow with level (it is a share of HP or a stat step) | the same: no help move grows with level |

So the answers to the owner's questions: **level counts the same in both** (damage and HP). **A move's power counts the same only between
moves of the same kind.** **Help moves ignore level in both, and in the scribble fight they also ignore the move's own numbers.** And a
flag of "+1 attack" would not count the same: added to the attack stat it is a share of the damage sum in both, but a scribble fight has
far more hits, so the same share decides a lot more there.

### The options

| | Option | For | Against |
| --- | --- | --- | --- |
| A | Flags as a plain share (+10 % damage for the flown type) in both sums, nothing else changed | small | "the same impact" only on paper: a fight of 40 hits feels +10 % very differently from a battle of 4 turns, and the two battles stay two sets of rules |
| B | **One "creature numbers" module both battles read** (`src/battlemath.js`, pure): the damage sum, HP, a help move's own amount, sleep and stat steps, the flag. Turn-based stays bit for bit as it is (only the flag is new). The scribble fight moves toward the move's own meaning: **a shot's wait grows a little with power** (a 100 shot waits longer than a 60 shot but does more a second); **heal heals the move's own amount**; **sleep lasts its turns x a fixed "turn" of about 1 s**; **speed sets walking speed in a narrow band** (0.9-1.1 x). A flag is **+10 % to one stat of the flown type's creatures**, applied in `battlemath`, so both battles read it from the same place | one source of truth; "a better move is better in both" becomes true; a flag means the same thing everywhere; the bots measure it | the biggest piece of chapter 3 before the world; every Live change must re-pass the mashing check; duels change (see below) |
| C | Flags only in scribble fights first, battles unified later | the world isn't held up | not what the owner asked for |

**Rec. B**, done in two steps so the world isn't held up:
1. **Measure first, change nothing:** `tests/battlenumbers.mjs` (Node) puts every creature's moves through both battles: damage per turn
   vs damage per second, by kind and power; heal and sleep values; how much level and a +10 % stat change each. One table for the owner
   (like section 9 of `chapter3.md`), with the cases where "the better move" differs between the two.
2. **Then unify the scribble fight's side** (`scribblefight.js` reads `battlemath.js`), each change measured with the bots, mashing
   still below a quarter. Turn-based battles are not touched except for flags.

**Flags then count in every battle:** a flag gives your creatures of its type +10 % to one stat (attack proposed; the son might like
choosing). Gym trainers and wild creatures never fly flags, so gyms get a little easier (the owner wants gyms easy). **Duels:** both
players' flown flags travel with the team; that is a battle-rule change, so the duel `VERSION` goes 14 -> 15 (an older friend's game
says it needs an update, as for every bump).

## 8. What the fight needs changed (only inside `scribblefight.js` / `scribble.js`, plus `battlemath.js`)

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
9. **The numbers from `battlemath.js`** (section 7, step 2).

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

## 10. Build order (each step behind `?preview`; each with naive / skilled bots, real keys through the game's loop and an iPad run; the `scribble` spec grows parts, e.g. `SCRIBBLE_ONLY=numbers|land|door|patches|look|loop|knot`)

1. **Battle numbers, measured only** (section 7 step 1): `tests/battlenumbers.mjs` and the table for the owner. Nothing changes in the game.
2. **Wobbleland as data** (`wobbleland.js`, Node-runnable): Inkpot Camp, Puddle Meadow with its wonky shapes, the wall, the six patch
   spots, the way back. Node checks: every patch reachable on foot from the Camp, every ring 75 %+ walkable, no patch inside another, the
   wall really closes Bumpy Hills. No fight yet.
3. **The Paper Door:** drawn for the Ally only, `REALMS.wobble`, arrive at the Camp, the way back, save / reload in the realm,
   follow-the-host. Spec: a save without `ally` sees no door; a test save with `wizard.ally` walks in and out with real keys.
4. **The look:** the first-draft palette, the curl (tried on an iPad first), grey regions and the colour flood; the spec proves every
   other world bit for bit; screenshots; draw calls and frame time.
5. **Patches from data in the fight:** `patternOf`, sizes, levels; the water twist with its Water advantage; bots on every patch at 60 and
   20 fps (mashing under a quarter over 12 fights a patch, skilled wins all, the person bot about 1-1.5 minutes); keys saved and reloaded.
6. **The loop:** guide arrow and "Where to go" rows, the meter chip, freed creatures catchable, +3 cubes, the Camp's healer, the Wizard's
   lines. A naive kid bot that only follows the arrow must reach every patch.
7. **The knot and its Grumble:** the weak-spot pattern (mashing it from the front must fail), the region flooding with colour, the wall
   melting, the Wizard's words. **End of the first slice: the owner and son play it.**
8. **After their verdict:** the scribble fight reads `battlemath.js` (section 7 step 2), then flags (the Flag Book, +10 % in every battle,
   duel `VERSION` 15), leaks near gyms, then Bumpy Hills with the Wizard beside you, Slippy Lake and Shadywood with their twists.

---

## Questions for the owner

1. **The look:** wonky shapes + a page that curls up in the distance + bright "beginner's" colours. Does that match "almost distorted, but
   not dystopian"? Is the curl OK, or does it sound dizzying?
2. **Battle numbers:** measure first (step 1), then make the scribble fight follow each move's own numbers (a stronger shot waits a bit
   longer, a heal heals its own amount, sleep lasts its turns, speed changes walking speed a little) while turn-based battles stay as they
   are. Agreed?
3. **Flags:** +10 % to one stat (attack?) of the flown type's creatures, in every battle including duels with friends. Fixed to attack,
   or should the child choose attack / defence / HP per flag? (You said earlier that versions of each flag aren't needed.)
4. **Type advantages per ground:** Water swims fast, Sky / Drake hop two blocks, Ice grips, Fire / Light / Electric / Cosmic see in the
   dark, Grass / Camo hide in tall grass. Any to change or add?
5. **Names:** Wobbleland, the Paper Door, Inkpot Camp, Puddle Meadow, Bumpy Hills, Slippy Lake, Shadywood, the Big Knot, smudge / tangle /
   knot, a Grumble. Happy, or ask your son?
6. **Order:** first slice first (steps 2-7) and the battle unification after, as planned, or the battle numbers straight after step 1?
