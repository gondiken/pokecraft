# Chapter 3's new world: a plan (2026-11-10, planning only, nothing built)

Built around the scribble fight that already works (`src/scribble.js`, `src/scribblefight.js`, `plans/chapter3.md` sections 7-10:
the camera rising from your eyes, the ring on the real ground, Dodge + two buttons with drawn kind icons, mashing loses, a person
wins in about 1-1.5 minutes). Every part below gives 2-3 options and a recommendation (**Rec.**). Nothing gets built until the owner
answers the questions at the end.

House rules that shape every choice: **easy to understand, hard to master** (a child gets it in one look + at most one short line; the
obvious shortcut never wins; naive bot fails, skilled bot wins, real keys, iPad); no Pokémon names; short, friendly text; reuse what
exists (realms, the Picture World kit, the guide, the fight); everything behind `?preview` until the owner opens it.

Working names used below (all open): **the First Page** (the world), **the Wizard's Camp** (the hub), **smudge / tangle / knot** (patch
sizes).

---

## 1. The story hook: why the Wizard sends you, and how you get in

Where chapter 2 ends (`STORY.md`, `studio.js` `END`): the Wizard is out on his island, you are his Ally, and he says *"Something
scribbly is still out there... I will need your help again."*

| | Option | Fits the story? | Cost |
| --- | --- | --- | --- |
| A | **The Wizard's first world.** Before our world he drew a first one. On it he drew a creature he didn't like, scribbled it out and shut the whole page away under his tower. When the Swirl cracked, the Scribble woke up there and is scribbling all over that unfinished world. He opens a stair under his tower: *"Down here I keep my old drawings. Come!"* | Very well: it is where the Scribble was thrown away, it explains why the land looks like ours but unfinished, and the ending ("finish drawing it") happens where it was first drawn. | A new realm (`parent: 'swirl'`, `entrance` like the tower's); the door is on the island that already has the Wizard, his tower and your guardian. |
| B | **A tear left by the crack.** The guardian closed the crack, but it left a ragged tear in the Swirl's sky; through it is the Scribble's land. | Weaker: the crack was just closed "for good". | A new spot in the Swirl (its terrain is versioned and packed: `swirlland.js`, version 6). |
| C | **Leaks first.** Patches appear in our world; the biggest one is a hole you step into. | Good for "the old world matters", but the way in moves around and a child may never find it. | A spot search in the main world (like `scribbleSpot`, which already had trouble on busy worlds). |

**Rec. A**, with C later as the reason to go back (part 5). The door: the Wizard's tower door on his island gets a crumpled-paper door
beside it (a grey `DoorGlow` from `portal.js`, `tint`), drawn only for the Ally; he stands next to it. A first talk: *"The Scribble is
in my old drawing. Let's colour it back in!"* Under `?preview` the door is there for anyone who reached the island, so the owner and son can
test without finishing chapter 2 again.

## 2. The world: size, places, look, how the Scribble shows

### Size

| | Option | For | Against |
| --- | --- | --- | --- |
| A | 160 x 160 (Swirl, Castle, Mirror) | quick to build and load | room for only ~10 patches with a 20-block ring and space between |
| B | **224 x 224** (Playland, Cube Planets, Pirate Seas) | room for a hub + 4 regions + the centre, ~30 patches; realm loading and draw calls already measured at this size | more to fill |
| C | 288 x 288 or larger | feels like a real "new world" | slow generation, much more empty land to fill, iPad memory |

**Rec. B.** A realm (`REALMS.scribble`, Node-runnable terrain in a new `scribbleland.js`, like every Picture World) so travel, saves,
follow-the-host, `lose: 'stay'` and the way back all come for free.

### Places (the whole chapter; the first slice builds only the Camp and region 1)

A ring of regions round a centre, each a different ground for fights (`plans/chapter3.md` section 5: "the terrain is the arena"):

1. **The Meadow Page** (first): gentle hills, trees and rocks as cover. Teaches the fight.
2. **The Hills**: high ground and drops; stomps only reach their own height, so standing high matters.
3. **The Frozen Lake**: ice, everyone slides (the arena's Ice Lake twist; Ice creatures keep their grip).
4. **The Dark Wood**: you see only near your light (the arena's Dark Cave twist; Fire, Light, Electric, Cosmic see further).
5. **The Scribble's Knot** (centre): a huge dark tangle; the end of the chapter.

**The Wizard's Camp** sits at one edge: a small coloured clearing with the stair back up, the Wizard, a Healer stand-in (`world.healer`)
and later his workshop. Regions open one after another: the way into the next is a scribble wall that melts once the region's knot is
cleared (a keep while it stands, like the Bubble Well's).

### Look: how it differs from the main world and the Picture Worlds

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **Our world, drained.** The main world's own blocks and biomes, but scribbled regions are grey (the colour drained out, a few pencil scribble strokes over the faces); each cleared patch floods colour back in a circle. The map's far edges fade into blank paper (it is unfinished). | Feels like the same game (the owner's fear: "two separate games"); the goal is visible in one look: grey bad, colour good. Different from the Sketchbook (pencil drawing on paper) and every themed Picture World. | Needs a colour mask in the shared block shader (see below). |
| B | Fully pencil, like the Sketchbook, colour painted in as you clear | Reuses the sketch shader | Too close to the Sketchbook; the scribble monsters were already rejected as "doodles" |
| C | Normal colours, only the scribble tangles and grey decals on the ground mark patches | Cheapest | No "the world gets its colour back" payoff; nothing tells a child how far they got |

**Rec. A.** Technique, as careful as the Sketchbook's switch: a small "colour" texture over the map (one texel per 4 x 4 blocks), read by
the block shader only under a new material define that is set only in this realm (like `SKETCH` in `sketch.js`), so a spec proves the main
world, the Dream, the Swirl and every Picture World render bit for bit the same. A cleared patch writes a soft circle into the texture
(and animates it growing out over ~2 s). The sky goes from a flat grey-white to blue as the region clears. Player-built blocks keep
their colours (like `swirlTint`).

### How the Scribble shows

- **From the Camp:** the Scribble itself, a huge angry dark tangle hanging over the centre, slowly churning (one instanced mesh, like the
  patch tangle), always on the skyline: the "where it all comes from".
- **Patches:** the existing tangle + ground decal, sized by how many monsters wait inside (smudge, tangle, knot).
- **Inside a region:** everything grey; you see coloured circles where you already won.
- Now and then a scribble line zips across the ground toward a patch (the Scribble feeding it). Only a look.

## 3. Scribbled patches: how many, how they get harder, what clearing does

### How many

| | Option |
| --- | --- |
| A | ~5 per region (25 + the centre): short regions, quick progress |
| B | **~6 per region, the last one a knot** (about 30 in the chapter; region 1 = 5 patches + its knot) |
| C | 10+ per region: lots of fights, risk of feeling like a grind (each is 1-1.5 minutes) |

**Rec. B.**

### How they get harder (never by plain numbers alone: the masher must keep losing)

| | Lever | Rule |
| --- | --- | --- |
| 1 | **Size you can see** | smudge 2 monsters, tangle 3-4, knot 4-5 + one big one in the middle (the size of the patch says it before you step in, `chapter3.md` section 5) |
| 2 | **Patterns** | smudges are only chargers; tangles mix charge + lob; knots add stomps, then two warnings at once |
| 3 | **The ground** | each region's twist (high ground, ice, dark) |
| 4 | **Types** | a patch holds creatures of the region's types: a team that beats them wins more easily (a reason to catch, part 5) |
| 5 | **Levels** | today the monsters take your strongest creature's level (the fix that stopped mashing with a mixed team). Keep that, with a small step by size: smudge -3, tangle 0, knot +2 |
| 6 | **The big one** (knots only) | a big scribbled creature with a weak spot: only hits from behind or after its warning count for full damage. A new pattern in `scribblefight.js` |

Monsters stop being the arena's fixed `FOES` list: each patch names its species, and a pure rule gives a species its fight pattern
(`patternOf(species)`, from data such as its moves' kinds via `movekinds.js`: rushers charge, heavy Rock / Metal / Bone bodies stomp,
the rest lob). Patch data lives in `scribbleland.js` as plain records (`{ id, x, z, size, species: [...] }`), append-only ids.

### What clearing one does

| | Option |
| --- | --- |
| A | Colour only (the circle floods back) |
| B | **Colour + the freed creatures + a small reward**: the scribble bursts off, colours come back, they hop away (all already built) and then **live there as wild creatures you can catch** (normal turn-based battle, `creatures.js`, a realm spawn table that grows with cleared patches); +3 Capture Cubes the first time; the region's meter goes up |
| C | B + an item per patch (a flag every time) |

**Rec. B.** The knot of a region gives the region's big reward (its flag(s), see part 5; the next region opens). Saved: one key per
patch, `pw:scribble:patch<id>` in `beaten` (the Picture World key form, which `loadKeys` already keeps), plus a version on the realm. A lost fight: your squad
rests at the Camp or the nearest rest (`realms.lost()`); the patch stays; nothing is lost. A cleared patch stays cleared (today's test
patch scribbles itself back after 20 s; in this world it doesn't). Optional for later: a cleared patch can be fought again just for fun
(`ForFun`), saving nothing.

## 4. The goal and the loop a child gets in a few seconds, and the end of the first slice

**One look:** the world is grey; around you there are tangles; the Camp behind you is in colour. **One line** (the first time):
*"Grey means the Scribble. Win, and the colour comes back!"*

**The loop:**
1. The guide arrow points to the nearest patch (realm `aim`, and patches as rows in "Where to go").
2. You see its size: small, medium, big. Walk in when ready.
3. Fight (the fight as it is now).
4. Win: colour floods out, the freed creatures hop away, the region meter ticks (`🎨 Meadow 3 / 6`, a score chip).
5. Lost: a rest, try again or try another patch first.
6. Between fights: catch a freed creature, heal at the Camp, swap your team.

**Hard to master:** the timed rush and the full big blast, using the ground (high spots, trees as cover), picking the right team for a
patch's types, the knot's weak spot.

**The end of the first slice:** the Meadow Page's knot. Clear it and the whole region floods with colour, the scribble wall to the Hills
melts, the Wizard says *"The Meadow is bright again! Next: the Hills."* and the region's flag flies over the Camp. The Hills stay a
"Coming soon" sign (like Playland's empty zones). That is the test for the owner and son: is the loop fun for five fights in a row?

## 5. Reasons to go back to the old world, and how the two connect

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **Catch counters.** Each patch's types are shown (the Book page link on its sign); the main world and the Picture Worlds are where you catch the types that beat them | free (everything exists); makes all 47 types matter | a soft reason, a child may not feel it |
| B | **Leaks in the old world.** After region 1, small scribble patches appear near gyms in our world (the leader: *"A scribble near my gym! Help!"*) and in Picture Worlds; clearing one gives **that gym's type flag**. The guide and "Where to go" point to them, so nothing is hidden | strong: old places get new life (`ROADMAP.md`: "scribbled zones appear in places you already know"); the son's flags, found, not hidden (the owner's worry was hiding them in the old world) | a patch spot rule per gym (gym boxes are known; the `scribbleSpot` search already exists) |
| C | **Flags only in the new world** | simple | no reason to go back |

**Rec. A + B, with flags split:** the new world's knots give the flags of their region's types; leaks near the 32 gyms give those gyms'
types; leaks in Picture Worlds give their types (Custom has no flag). Every flag is found by clearing a scribble, so flags and the Scribble
tie together. **How the worlds connect:** one way in (the Wizard's island in the Swirl), the way back from the Camp to the island; the
Portal Door already links our world and the Swirl. No new shortcut is needed for the first slice; later the Wizard could give a "paper
plane" home from any cleared region.

**Flags (owner's open questions in `chapter3.md` section 1, my proposal):** a small boost (+10 %) to creatures of the flown flag's
type, **in scribble fights only** at first (no duel `VERSION` bump, gyms stay easy); a Flag Book tab in the Book (next to Badges and
Stars, `BOOK_TABS`); fly one at a time, chosen there; flown over the Camp (and over your home later).

## 6. Later pieces (outline only)

- **The Wizard beside you:** from region 2, the Wizard walks into a fight with you: his creature is a fourth fighter on your side
  (computer-controlled, like the arena's foes but friendly). Later his **big spell**: herd the monsters into his glowing circle and it
  bursts (a positioning skill, not a button). Turn-based "two against one" (T29's `'friend'` side) stays an option for the knots' big ones.
- **Eggs:** from region 2, a knot's big one doesn't hop away: the Wizard turns it back into an egg (`STORY.md`). You carry it in a team
  slot and it hatches by walking; some only hatch with a friend nearby (wave 17's play together). Eggs replace "freed creatures to catch"
  for the rarest ones.
- **Crafting / the Wizard's workshop:** at the Camp. Cleared patches leave colour behind (a few paint drops each, never star-shaped);
  the workshop turns paint + blocks into Capture Cubes, the region's coloured blocks to build with, and later potions (mixing, the
  roadmap's idea). Builds on the Wizard's Tower's paint pots and mixing (`wizardtower.js` `mixPaint`).
- **Friends:** a friend follows you in (realms together, T38b) and fights in the same ring with their own creature (the hardest piece:
  both browsers would have to agree on the fight; later).
- **The ending:** at the centre you help the Wizard **finish drawing the Scribble** (his drawing board again), and it becomes a friend.

## 7. What the fight needs changed for this world (only inside `scribblefight.js` / `scribble.js`)

1. **Many patches, from data:** `createScribble` takes a list (`world.patches` in the realm; the main world keeps today's single test
   patch until the owner drops it). Only patches within ~60 blocks are drawn (draw calls on the iPad).
2. **Monsters from the patch:** `opts.foes` already exists; add `patternOf(species)` (pure) and the patch's size rule (count, level step).
3. **Saved results:** a won patch sets its key and stays coloured; the 20 s "scribble back" only for the main-world test patch.
4. **Ground twists:** port the arena's ice slide and darkness into `groundOf(world)` as properties of the ground (`slick(x, z)`,
   `dark`), so the real terrain decides them, never a mode switch.
5. **The big one:** a new pattern with a weak spot (a back to get behind, shown on the creature, not in words).
6. **More monsters at once (up to 6):** the spawn spots round your creature (`spotAround`), the warnings never stacking unreadably, and
   the mashing check again (mashing at 20 fps was closest to the quarter limit, 11 / 48).
7. **Patch spots are placed by hand in the terrain** (flat enough, no water inside the ring) and checked in Node, instead of
   `scribbleSpot`'s search.
8. **Hooks out:** `onWin(patch)` / `onLose(patch)` for the colour mask, the chip, the freed creatures and keys; the colour flood itself
   lives with the look (part 2), not in the fight.

The ring stays radius 10 (`chapter3.md`: kept for now). The arena (`arena.html`, `src/arena/`) stays untouched.

## 8. Build order (each step behind `?preview`; each with naive / skilled bots, real keys through the game's loop and an iPad run; spec `scribble` grows parts, e.g. `SCRIBBLE_ONLY=land|patches|look|region|...`)

1. **The world as data** (`scribbleland.js`, Node-runnable): the Camp, region 1, the scribble wall, the patch spots, the way back.
   Check in Node: every patch reachable on foot from the Camp, every ring 75 %+ dry and walkable, no patch inside another, the wall
   really closes the Hills. *No fight yet.*
2. **The way in:** the paper door on the Wizard's island (Ally, or `?preview`), `REALMS.scribble`, arrive at the Camp, the way back,
   save / reload in the realm, follow-the-host. Real keys: walk from the island in and out.
3. **Patches from data in the fight:** `patternOf`, sizes, levels; bots on every region-1 patch at 60 and 20 fps: mashing under a quarter
   over 12 fights a patch, skilled wins all, the person bot about 1-1.5 minutes; keys saved and reloaded.
4. **The look:** grey regions + the colour flood; the spec proves every other world bit for bit; screenshots before / after a win; draw
   calls and frame time measured.
5. **The loop:** guide arrow and "Where to go" rows, the meter chip, the freed creatures as catchable wild ones, +3 cubes, the Camp's
   healer and the Wizard's lines. A "naive kid" walking through: does the arrow alone bring it to every patch?
6. **The knot and the big one:** the weak-spot pattern, bots (mashing the big one from the front must fail), the region flooding with
   colour, the wall melting, the Wizard's words. **End of the first slice: the owner and son play it.**
7. After their verdict: flags (Flag Book tab, the boost in scribble fights), leaks near gyms, then region 2 with the Wizard beside you.

---

## Questions for the owner

1. **The way in:** the Wizard's first world under his tower (my pick), a tear in the Swirl, or patches in our world leading in?
2. **Who gets in:** only the Wizard's Ally (after chapter 2), or anyone who reached the Swirl? (While testing it is `?preview` either way.)
3. **The look:** "our world with the colour drained out, colour floods back when you win" (my pick): does that sound right, or would you
   like it more different from our world?
4. **Freed creatures:** should they become wild creatures you can catch there (my pick), or only hop away until eggs exist?
5. **Flags:** found by clearing scribbles, region knots in the new world and leaks near the gyms in the old one (my pick)? Boost only in
   scribble fights at first?
6. **Size of the first slice:** one region (5 patches + a knot, about 10 minutes of fights) enough to judge the loop?
7. **Names:** "the First Page" / "the Wizard's Camp" / smudge, tangle, knot: keep, or does your son want to name them?
8. **The ring:** still keep the radius 10 fence in this world?
