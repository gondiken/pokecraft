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
   skilled wins all, the person bot about 1-1.5 minutes; the table to the owner (with the speed question).
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

## Questions for the owner

Answered 2026-11-11: the look as described, flags +10 % attack, names kept for now, heal stays 45 %, moves get their kind by nature with
advantages and disadvantages per kind (section 7).

Still open (the night run decides each and writes it in "Decided overnight"; the owner may change it in the morning):
1. The kind list by type (step 1): any moves to move to another kind, and does any type need a new move to have all four kinds?
2. The numbers per kind (step 1b) and how much speed changes.
3. The look, when step 4 shows it (and whether the curling horizon stays).
