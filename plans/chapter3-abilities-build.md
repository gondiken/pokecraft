# Chapter 3: creature abilities, the build plan (owner 2026-11-13)

How the design talk in `plans/chapter3-ways.md` section 10 ended, turned into steps. The page with the full map, the grid and every
creature: https://claude.ai/artifact/EdtF4Naq98N1fUHBLhstny (private to the owner). This file is the source of truth for the build;
the page is the picture of it.

## 0. What was decided

1. **Every creature walks.** On top, its TYPE gives a set of abilities (none, one or several). **Every creature of a type has all of
   them** (never "some fly, some swim"). Types and abilities are many to many.
2. **The card says it:** a creature's abilities show as chips ([🪽 Fly] [💡 Glow]) on every card: team screen, Book, Swap, the
   creature you are. Walking has no chip.
3. **The world says what it needs:** at a place, the button word appears if your creature can ("Climb!"); if not, the place shows
   the chip it needs and which of your squad have it.
4. **Looks only must not contradict:** no wings in a type without Fly, no fish in a type without Swim. Other abilities need no drawing.
5. **Nobody changes type.** A creature whose body contradicts its type is **redesigned** (new body, often a new name) and stays in its
   type. A type that needs a little help gets a **type look** (drawn on every creature of the type that lacks it) or a small
   **animation** (same body, moves a bit differently).
6. **Owner 2026-11-13: a redesign reaches every player.** The species **id never changes**; a save stores only the id, so name and
   model come from `SPECIES` and every player who owns the creature sees its new name and shape at the next load (Book seen / caught
   are by id too). No save migration.
7. Sound walks AND flies ("sound travels through the air"): Boomwing and Echobat stay exactly as they are.

## 1. The 19 abilities (final, owner 2026-11-14; ids are saved: append-only, never renamed)

Section 7 led here: Bounce dropped, Dash -> Sprint, Hide -> Sneak, Rewind / Grow / Heal added. The guardian's chosen ability is the
first id saved (in its design, `ab`), so from now on an id never changes. Built in step B as `src/abilities.js` (`ABILITIES`, `TYPE_ABILITIES`).

| id | Ability | What a place asks (each solves something no other ability can) | Types |
| --- | --- | --- | --- |
| fly | 🪽 Fly | open sky, a gap with no floor; rises only 6 over the ground right below (`RIDE.sky.cap`) | bug, ghost, mind, pixie, drake, rainbow, cosmic, sound, alien, sky, paper, bubble, gravity |
| swim | 🌊 Swim | speed in water: a swim race, catching a fast swimmer, an underwater gate before it shuts (anyone can dive) | water, pirate, atlantis, bubble |
| climb | 🧗 Climb | a sheer wall taller than the 6-block fly cap | grass, bug, slime, parkour, ninja, gravity |
| dig | ⛏️ Dig | soft earth, buried chests | bone, treasure, pirate, rock |
| squeeze | 📄 Squeeze | a crack in real stone | slime, paper, tiny, doodle |
| pass | 👻 Pass through | faded, half-erased pencil walls only (solid to everyone else) | ghost, dream, portal, mirror |
| glow | 💡 Glow | the dark | fire, electric, rainbow, cosmic, light, atlantis |
| burn | 🔥 Burn | thorns, tangles, ice walls | fire, toxic, drake |
| freeze | ❄️ Freeze | moving water stops: a river's current, a waterfall into an ice wall (a climber then goes up) | ice |
| zap | ⚡ Zap | a machine: power a lift, a bridge, a door | electric, metal, cyber |
| sprint | 💨 Sprint (was dash) | closing doors, crumbling floors: fast enough makes it | parkour, racer |
| rewind | ⏪ Rewind | a place where it is already too late when you walk in (the bridge fell, the door slammed) | time |
| push | 💪 Push | boulders and balls (no longer breaks cracked walls) | normal, metal, squad, knight, rock, ball |
| sneak | 🥷 Sneak (was hide) | sneak past someone watching | camo, ninja, tiny |
| lift | ✨ Lift | something you see but can never reach (a cage, behind glass) | mind, alien |
| charm | 💖 Charm | win over someone grumpy (a treat when it looks at you) | pixie, cozy, food, funfair, surprise |
| sense | 🔊 Sense | an echo shows a hidden path; remember it | mind, sound |
| grow | 🌱 Grow | cracked stone: roots split it | grass |
| heal | 💚 Heal | grey scribbled things back to colour (a wilted vine bridge, a grumpy grey creature) | pixie, cozy, food |

No Bounce. Custom has none of its own: the guardian has **Fly when its kit parts fly** (wings or the cloud, guardiankit `flies`) plus
**one ability chosen** on the drawing board (Fly is never chosen; saved in the design as `ab`, `cleanDesign` keeps it).

## 2. The 22 redesigns (id, stats, moves, evolution, catch rate kept; name, desc, model, flags, spawns may change)

**Names are decided** (2026-11-13). Rule: keep a name when it still fits the new body, so players lose as little as possible.

| id (type) | Name (old -> new) | New body |
| --- | --- | --- |
| finnibone (bone) | Finnibone (kept) | a bony fish that walks on its fins like a mudskipper, clacking along the cave floor |
| twirlshell (bug) | Twirlshell (kept) | a swirly-shelled snail with little dragonfly wings, buzzing from leaf to leaf |
| wifly (cyber) | Wifly -> **Wiflow** | a little Wi-Fi router toddling on stubby legs, signal bars on its back |
| wifly2 (cyber) | Wifly 2.0 -> **Wiflow 2.0** | a tower router striding on four legs, full signal bars |
| error404 (cyber) | Error404 (kept) | a glitchy pixel cat that flickers and skips frames as it walks |
| voltwing (electric) | Voltwing (kept, owner 2026-11-14) | the same bird with small wings; it walks instead of flying |
| wattwink (electric) | Wattwink (kept) | a glow-worm whose tail is a light bulb; it blinks hello on warm nights |
| joltail (electric) | Joltail (kept) | a land eel that slithers through wet grass, lighting it up with little zaps |
| flarehawk (fire) | Flarehawk -> **Flaremu** | an emu with a flaming tail plume that sprints across the plains |
| rivetron (metal) | Rivetron (kept) | a big tin beetle on rolling treads; its engine wings only buzz (nutlet, its first form, already walks) |
| peekaw (ninja) | Peekaw -> **Peekko** | a tiptoeing gecko that hides behind its own tail and peeks |
| ravenshade (ninja) | Ravenshade -> **Ninjecko** | a big masked gecko that creeps along walls without a sound |
| chirpit (normal) | Chirpit (kept) | a fluffy turkey chick that chirps and struts about at sunrise |
| loudbeak (normal) | Loudbeak (kept) | a peacock that fans its tail with a call that wakes the whole village |
| parroteer (pirate) | Parroteer -> **Monkeer** | a little monkey in a striped bandana that repeats everything you say |
| featherbeard (pirate) | Featherbeard -> **Bananabeard** | a monkey captain with a big hat, a long red coat and a banana-yellow beard |
| loopwyrm (portal) | Loopwyrm (kept) | a long snake that rolls like a hoop, a swirl in each loop |
| shimmerfin (rainbow) | Shimmerfin -> **Shimmerscale** | a little pangolin whose scales sparkle in every colour (never a swimmer) |
| spectrafin (rainbow) | Spectrafin -> **Spectrascale** | a big rainbow pangolin, good luck to see; ridden on LAND now (`traits.js` water -> land) |
| ringlet (treasure) | Ringlet (kept) | a gold ring that rolls along on its edge, gem eye on top |
| lustrelle (treasure) | Lustrelle (kept) | a gem candelabra that walks on its candle legs |
| gullop (water) | Gullop (kept, owner 2026-11-14) | a noisy duck (the old bird with a flat bill, small wings, webbed feet) that swims and waddles |

The bodies are the brief; the building session may refine details, then shows the owner screenshots before finishing.

**Type looks** (one thing drawn on the creatures listed; the rest of the type already fits):
alien = a hover glow under its feet (zorbit, blipling, blipstar, podlet, tallipod); cosmic = a stardust trail (moonhop, lunaroo);
gravity = little orbiting moons (orbikit, orbitah, danglet, turvysloth, wallibex); mind = a soft lifting glow (thinkit, visionelk,
puzzlet); paper = folds into a glider / a book flaps its pages (hopfold, frogami, pagelet, grandtome); pixie = small fairy wings
(starbelle, pompet, pomperina); rainbow = runs up its own rainbow (prismkit, spectrion, chromacurl); sound = rides its own sound
waves, rings of notes under it in the air (drumbo, bongorilla, gongolin, clawdio). Show a type look only while flying is fine.

**Animations only** (same body): beetlet, hornbeetle (wing cases open in flight), glitterbop (bops on the ground), pinwhirl (spins up
like a propeller), twilorb (rolls). Scalekin already has small wings.

## 3. Steps (each one session; the first is only the redesigns)

**A. The creature redesigns only** (no abilities yet; nothing changes in how anyone moves)
**Owner 2026-11-14:** Wiflow / Wiflow 2.0 / Error 404 keep their old bodies (walking, not floating), Voltwing keeps its name and bird body with small wings, Gullop is a duck (old bird + flat bill, swims). **Built 2026-11-13** (spec `redesign`, pictures `node tests/redesign-preview.mjs`): as below, plus: Joltail in meadows and swamps, Shimmerscale / Spectrascale in meadows and forests by day; Monkeer left the open-sea table; the Pirate Seas' Boss is renamed Captain Bananabeard (his "Squawk!" is "Ook ook!") and Parrot Perch is Palm Perch; Glitterbop and Twilorb no longer float; a type look is drawn always (small), not only in flight.
1. For each of the 22 in section 2, in `species.js`: same id; the new `name` where it changes, a new `desc`, a new `model` (a new body
   builder in `shapes.js` for a new family: the owner wants unique looks, evolutions may share one), `flies` / `floats` removed where the
   new body walks (twirlshell keeps flying). Move `SPAWNS` entries to biomes that fit (fish and sea birds that now walk leave water
   tables; check `blocks` / `roster` coverage specs).
2. `traits.js`: spectrafin's ride `water` -> `land`.
3. The eight type looks and five animations of section 2 (shapes.js / `animateModel`); a type look may show only while flying (that
   is chapter 3, so it can wait for step C if it needs creature mode). Keep draw calls low (`tests/perf.mjs`).
4. Texts: `grep` every old name (Voltwing, Flarehawk, Peekaw, Ravenshade, Parroteer, Featherbeard, Shimmerfin, Spectrafin, Gullop,
   Wifly) and every line that describes an old body (wings, fins, feathers) in `src/`, `README.md`, `STORY.md`, gym dialogue.
   Gym teams, Wobbleland patches and Bosses keep the ids: only check that their battles look right.
5. **No duel `VERSION` or `WORLD_VERSION` bump**: stats, moves, types and ids stay the same; only names and looks change.
6. Spec `redesign`: the 22 ids exist with stats, learn sets, evolutions, types and catch rates unchanged (compare with a fixture
   recorded before the change); no redesigned walker has `flies` / `floats`; an old save holding Flarehawk, Spectrafin and Wifly 2.0
   loads with the new names and models in the team, the box and the Book, and Spectrascale is ridden on land. Re-run `roster`,
   `blocks`, `seventh`, `four-types`, `three-types`, `ninja`, `pirate`, `fx`, `book`, `riding`, `traits`, `swap`, `pvp`, `gym`.
   A model photographer (like `tests/houseprops-preview.mjs`) for the owner: every redesign beside its old look.

**B. Abilities data + chips on cards** (**built 2026-11-14**, spec `abilities`: `src/abilities.js`, `src/abilitychips.js`, the drawing board's Ability tab; chips on the team screen and its trade mode, the trade bar, the Book's creature and type pages, the HUD row of the creature you are)
`src/abilities.js` (pure, no imports): `ABILITIES` (the 19, append-only ids, icon, name, short line), `TYPE_ABILITIES`,
`abilitiesOf(species, creature)` (from its type; the guardian from its design, section 6), `hasAbility`. Spec `abilities`: every wild
type mapped; consistency (no `flies` species in a type without Fly, every sky-ride species in a Fly type, every water-ride species in
a Swim type, no fish shape in a type without Swim). Then the chips:

Team screen card, the Book's creature page (and a type's abilities on its type page), the Swap list, the trade cards, the creature you
are (chapter 3). One chip style, icons from `ABILITIES`. Readable on the iPad. Spec: chips present and equal for two creatures of one
type.

**C. The world says what it needs** (chapter 3, ?preview) (**built 2026-11-14**, specs `ways`, `abilities`; bots `node tests/waysbots.mjs`)
As built: `src/abilityplaces.js` (pure): a place is data `{ id, needs, box, badge }` in `world.needPlaces` (wayland.js `NEED_PLACES`);
`placeAt`, `needOf` (-> `has`, `word` = the ability's `verb`, `who` = which of your three have it), `swapTo` (Swap goes straight to the
next one that has it, also from Be me), `ACTS` (what the button does; only `climb`: held = push toward the wall you face, `be.grab`).
wobblelive.js `NeedPlaces`: the drawn badge floats over the place (a sprite from `abilitySvg`), the button word ("Climb!", prompt
"Hold E to climb"), and when you lack it the card `#need` (badge, "Needs Climb", your three: the ones that can lit, the Swap target ringed).
`creatureways.js`: WAYS / wings gone; `bodyOf(id, sp, c)` = `abilitiesOf` -> `fly` (the sky ride), `swim` (the water ride, only in water;
everyone else still swims slowly), `climb` (`clingStep`; a flier with Climb, Bug / Gravity, grips a wall it flies into). Removed: the
wing-folding rule (`wingRoom`: no wings in tight places) and the `flies` / sky-ride wings; `tightAt` stays only for the camera.
The Drip Tower = Climb (the shaft is 15 sheer blocks, the fly cap 6: fliers top out at 17 of 27; gliding in from the cave hill tops out at
23). **Storm Island was dropped** (owner 2026-11-14: Fly gets a real place in step D). Glowcap Caves: `Dark.BRIGHT` = the Glow types
(Rainbow and Atlantis joined); `KEEN` (Ghost, Ninja) kept.
A generic hook for a place: `needs: '<ability>'` -> the button word if the creature you are has it; if not, the place shows the chip
and lights up which of your three have it (Swap is one tap). `creatureways.js` WAYS / `bodyOf` are replaced by `abilitiesOf`: in
creature mode a creature flies iff its type has Fly, dives iff Swim, climbs iff Climb (`clingStep` exists). Convert the two test
places: the Drip Tower = Climb; Storm Island = Fly (owner: it was "just timing": redo it as a real flying skill, or drop it).
Glowcap Caves: `groundrules.js` `Dark.BRIGHT` reads Glow (adds Rainbow and Atlantis; re-run `wobble` cave bots).

**D. One real place per ability, two at a time** (Bumpy Hills, then the next regions)
**Overnight 2026-11-15/16** (built while the owner slept; nothing waited for an answer: every choice below is mine and can be changed)

*Morning summary* (kept up to date after each pair; the details are under each pair below):
- Pair 1, **Dig + Push**: built, committed and pushed (spec `ways` parts `bots`, `dig`, `push`, `earthipad`, `pose`; `node tests/waysbots.mjs`).
- Pair 2, **Burn + Freeze**: built, committed and pushed (spec `ways` parts `bots`, `burn`, `freeze`, `fireipad`; `node tests/waysbots.mjs`).
- Pair 3, **Squeeze + Pass through**: not started yet.
- Also: the action button says nothing at a wall in Wobbleland (it said "Break"); the climbing pose has four gripping paws.

*Decisions for all pairs (how an ability acts on a thing):*
- **Aim + the big button for things you work on (Dig, and later Burn, Freeze); walking into it for things you move or go through (Push,
  and later Squeeze, Pass).** Why: digging is what breaking a block always was (look at it, press), so a child already knows it, and the
  button's word ("Dig!") is a real word only when the creature you are can; pushing a boulder is just walking into it (no button, like
  climbing). Never a hold. Alternatives: walking into soft earth digs (no aiming, but then every walk along a mound would dig; and a
  buried chest needs digging DOWN); a button for pushing (a needless extra step). `src/things.js`: one table `THINGS` (kind -> ability,
  aim / walk, its "why" line), `aimAt` (a ray that also sees water: Freeze will aim at it), `aimedThing`, `walkedInto`.
- **The "why" line** lives in `THINGS[kind].why` (said once per session, like a block's `noGrip`), e.g. "Soft earth! Only a digger can
  dig it." / "Too heavy! Only a strong creature can push it.". The place's card ("Needs Dig") still only comes after 3 tries.
- **Colour:** Bumpy Hills is still grey ("being drawn"), and grey soft earth looked like stone. Every place of these pairs is in colour
  (`world.colourSpots`, read by wobblelook.js like the river's colour): a child must see soft earth is earth. Question: fine, or should
  they stay grey until Bumpy Hills is drawn?
- **Rewards:** the game's own chests (+3 Capture Cubes, saved as opened like every chest). The skill places put theirs in a glass case
  that opens when you win (it shuts again when you leave, so it can be played again for fun). No new save keys.
- **No new block ids** (all 256 are used): soft earth is Mud; boulders and balls are models over the hidden solid `HOUSE_PROP` (moved
  with `setLive` / `LiveCells`, never saved).
- **Action button:** in Wobbleland it no longer says "Break" (nothing breaks there); it says nothing at a wall, "Dig!" at soft earth you
  can dig, "Open" at a chest (main.js `updateTarget`).
- **Climbing pose** (being.js `CLIMB_POSE`, `grips`): from behind it read as a flat slab (it lay back 1.15 rad). Now it leans in only
  0.5, sways, and four paws in its own colour grip the wall at its sides, the diagonal pairs reaching up in turn as it climbs.
  Screenshots from behind, the side and three quarters: `plans/chapter3/dig-push/ways-pose-*.png`.

*Pair 1: Dig + Push* (`src/earthworks.js`, `src/things.js`; built into the land by wayland.js `waysLand`, stepped by its `Trials`
(`EarthRun`), drawn by wobblelive.js `Earthworks`):
- **Dig, natural spots:** six **mounds** of soft earth (a 3 x 3 hump with a cross on top) all over Wobbleland (four in Bumpy Hills, two in
  Puddle Meadow); a chest is buried one under its middle. A digger looks at it and taps: two digs and the chest shows. Dug earth comes
  back when you are far away. Types with Dig: Bone, Treasure, Pirate, Rock.
- **Dig, the deeper place: the Warm-or-Cold Dig** (Bumpy Hills, x 132, z 40): a square of 7 x 7 soft earth (two deep) by a glass case.
  A gold key is buried under one square; each hole glows how close it is (red = next to it, orange = 2 away, yellow = 3, blue = cold),
  little red flags on the rim fall one per wrong hole, and the 6th wrong hole makes the earth rumble shut and the key move. Skill =
  reading the colours (directional thinking, a kid's "hot or cold"); it is mind + skill, which the owner allowed where it fits. Every
  square is in reach from outside the rim (why 7 x 7: at 9 x 9 the middle was out of reach). Bots: a skilled digger (digs the square
  that splits the possible squares best) always finds it in 2-5 digs (worst case 4 with perfect play); digging at random 1/12 · 0/12;
  no digger 0. Alternatives I weighed: a dig race against a scribble mole (pure speed: mashing would win), a tide that refills holes
  (timing, but a naive kid wins by luck), whack-a-mole (the Surprise Party already has one).
- **Push, natural spots:** three **boulder caves** (rock lumps with a 2 x 2 x 2 boulder in the mouth and a chest inside): walk into the
  boulder and a pusher pushes it a block per push (a boulder is heavy and does not roll); it rolls home when you are far away. Types with
  Push: Normal, Metal, Squad, Knight, Rock, Ball.
- **Push, the deeper place: the Ball Garden** (Bumpy Hills, x 90, z 40): a walled garden (a low wall you hop over; a ball never) with
  stone posts and two holes; two stone balls ROLL when pushed until they bump something or drop into a hole. Both holes full = the glass
  case opens; walk out and the balls roll home. Skill = directional tactics: use the posts as stops (the layout came from a search: 5
  pushes; pushing each ball straight at its nearest hole only sends it to the wall). Bots: the 5 pushes open it (about 9 s), the straight
  pusher never, nobody without Push. Alternatives: a Sokoban yard (one block per push: a slower puzzle), a boulder on Slippy Lake's ice
  (the right idea, but you slide too: pushing from the right side on ice was too fiddly for a child and for the bots), bowling (too
  close to the Ball Stadium).
- Questions I would have asked: (1) Is the Warm-or-Cold Dig's 6 tries right, or should a wrong round just go on (no rumble)? (2) Should
  a found key / an opened case give something more than the chest (a star-free prize, a new paint pot)? (3) Mud for soft earth, or a new
  look (a model of loose clods over it)?

*Pair 2: Burn + Freeze* (`src/fireice.js`; built by wayland.js `waysLand`, stepped by `Trials` (`FireIceRun`), drawn by wobblelive.js `FireIce`):
- Both act on a thing you look at with the big button ("Burn!", "Freeze!"), like Dig. Burn: Fire, Toxic, Drake. Freeze: Ice.
- **Burn, natural spots:** three **thickets** (hedge huts, a door of brambles: a tangle of dark twigs with red thorns, drawn over the hidden
  solid block) and two **ice huts** on Slippy Lake's shore (snow, a door of thick ice). Burn = the whole door burns away / melts; it
  grows back when you are far away. Why lines: "Thorns! Only fire can burn them away." / "Thick ice! Only fire can melt it."
- **Burn, the deeper place: the Windy Bramble Tunnel** (Bumpy Hills, x 140, z 16): a hedge tunnel with five bramble plugs, a chest at
  the end. The wind takes turns blowing in and out with a short calm between (a windsock at the mouth, leaves blowing through the tunnel;
  the flames lean with it). A plug takes 1 s to burn through; if the wind blows at you meanwhile the fire blows back: "Whoosh!", puffed
  back to the mouth and the plugs grow back. Skill = timing + reading the wind (fire follows the wind: natural). Bots: lighting each plug
  as the windsock swings in 8/8 · 8/8 (about 20 s), lighting at once (mashing) 0/8 · 0/8, nobody without Burn. First version let a masher
  win (a press in the calm was free, so mashing lit every plug at the very start of a blow); fixed by the burn time and the plain
  in / out turns.
- **Freeze:** any water you look at freezes over (its top, about 2 round where you look); frozen water has no current and you walk on it;
  it thaws after 25 s or when you are far away. A waterfall freezes as a whole into rough ice (bright bumpy chunks: not the cliff's smooth
  ice) that a climber can grip.
- **Freeze, natural spots:** two **rapids** (a stream rushing out of a low stone tunnel, the chest on a ledge at its spring). The current
  (12 a second) beats a sprinting Swim creature (10.5) and a diving one with kicks; its spray pushes a flier back and nobody grips the
  wet walls (new world hook `world.pushAt`, read by player.js `fly` and `clingStep`; only Wobbleland has it). Frozen: walk up on the ice.
- **Freeze, the deeper place: the Frozen Falls** (Bumpy Hills, x 40, z 4; the owner's own example, two abilities together): a waterfall
  down an ice cliff 18 tall (its top above the cloud layer), a chest on top. Freeze it as an Ice creature, Swap to a climber at once and
  climb before it melts (8 s, then from the top down: "Drip, drip... the ice is melting!"). A waterfall also pushes a swimmer down
  (player.js: a downward flow). Bots: freeze + swap + climb 4/4 · 4/4 (6.6 s), a Bug 4/4, waiting 4 s first 0, the freezer or the
  climber alone 0, a flier 0, a swimmer 0.
- Decisions: the tunnel's chest and the falls' chest are ordinary chests (no case); freezing works on ANY water (natural: a child will
  try puddles; it harms nothing, it thaws). Alternatives: Freeze only on marked "running water" (felt arbitrary); Burn on every hedge
  (the Castle's hedges are not brambles; only thorns burn). The ice cliff stays smooth `ICE` (noGrip), the frozen falls are a hidden
  solid block under a model, so climbing tells them apart without a new block id.
- Questions I would have asked: (1) Should Burn also melt Slippy Lake's ice (dangerous: the lake would become water)? I said no: only
  ice walls. (2) The Frozen Falls lasts 8 s: right for a child on the iPad, or longer on Easy (step E)? (3) Should the brambles hurt
  (a little push back) or just block?

**Owner 2026-11-15, third play:** "I still can't seem to understand the difference between Bottlet and Blazehound in speed within the
river" and "I can't seem to switch to Tightropa ... while in the river". Two bugs: (1) in shallow water (the meadow's zigzag river,
puddles) a swimmer stands on the bottom and walked like everyone (2.4); now a Swim creature is fast in any water (player.js walkStep:
`BE_SWIM`; bots `runCurrents` "shallow": Bottlet 8.2 vs Blazehound / Tightropa 2.8 blocks in 1.2 s). (2) At a place that needs Swim (the
Sluice Gate's channel, its "high current" jets) with the hint up, Swap always jumped to the swimmer, so it went Bottlet <-> Blazehound
and never reached Tightropa; now it jumps to a creature that can ONCE per visit, then goes round all three (spec `ways` places).

**Owner 2026-11-14/15, second play:** climbing worked on the crags "but not on the outer wall of the drip tower. that was strange";
"why flyers can't fly above a certain level ... illogical" (in chapters 1-2 a flier "almost teleported right 6 block above the tall surface
they were flying over"); "I couldn't figure out swimming at all. I used Bottlet vs Tightropa and both had the same speed in that high current
water"; "fix the animations for climbing ... awkward to see the same character just moving vertically up near the wall". Built:
- **A fixed sky ceiling** (owner's pick): in Wobbleland wings go up to one height, `FLY_CEILING` 26 (`world.flyCeiling`, player.js `fly`;
  15 over the meadow, 5 over the cave hill), drawn as puffy cotton clouds just above it (wobblelive.js `CloudLayer`, one instanced mesh;
  puffs near the camera are hidden), with one line the first time ("Wings only go up to the clouds!"). The crags now top out at 29 and the
  Drip Tower's roof is 27, both above it. Chapters 1-2 keep "6 over what is under you".
- **The Drip Tower's ice made obvious** (owner's pick): a glossy blue skin, shine streaks and icicles; a climber walking into ice (or a
  cloud) is told once why (`noGrip` is now the text: "Too slippery! Ice can't be climbed.").
- **Swimming:** a creature with Swim is 1.7x as fast at the surface too (`BE_SWIM`), and only swims where it is not standing on the bottom
  (in shallow water everyone wades: the old rule made Bottlet swim slowly where Tightropa ran on the riverbed). Bots (`runCurrents`): 3 s
  upstream in the floating river / a lake lead / the cave river: Bottlet 11-20 blocks, Tidalord the same; Tightropa, a walker and you on
  foot never more than 1 (carried back).
- **Climbing pose** (being.js): it turns to face the wall, leans its front up it, wiggles side to side and bobs in step (`pose`, `tilt`).

**Owner 2026-11-14, after playing (rebuilt the same day):** "A climber, flyer etc shouldn't have to press E ... these attributes should
be applicable ANYWHERE in the world ... climbers could only climb inside the tower with very obvious directions, which doesn't give any
chance to the player to think 'oh wait I have a climber'"; "the fly challenge pretty lame"; "climb challenge itself was interesting, it just
needed that general element of being part of the game rather than a spotlighted place". Decided (owner's picks): abilities work all over
Wobbleland with the usual controls (Jump flies like riding, walking into any wall climbs, looking down dives, Jump kicks under water; no
E, no button words, `ACTS` and `verb` removed); **the hint only after trying** (`NeedHints`: walking into a place's box 3 times without
what it needs, or every 8 s spent in it, then the card; Swap goes straight to a creature that can only once the card shows; no floating
badges); **the Floating Isles were removed**; the Drip Tower and the Sluice Gate stay as ordinary parts of Bumpy Hills; **natural spots**
(`wayland.js` `SPOTS`): three sheer crags (8-10 tall, a chest on top: only a climber, a flier stops at the cap) and four clouds floating
5 over the ground (a chest: only a flier; no wall, too high to jump), in Bumpy Hills, its far north and over Slippy Lake's ice. Bots
(`runSpots`): every crag only climbers (a Bug flies into it and climbs), every cloud only fliers, at 60 and 20 fps.

**Built 2026-11-14 (first version, partly replaced above): Fly + Swim** (owner's pick), specs `ways` (parts `bots`, `places`, `ipad`), bots `node tests/waysbots.mjs`:
- **The Floating Isles (Fly, `src/skyisles.js`)** where Storm Island was: five cloud islands, each 2 higher, over a pit of ink; over the
  ink the fly cap drops (6 over the ink), so you sink 4 a second: hover to your highest at the island's edge, then go straight. The
  fourth drifts toward you and away (gap 6..12, go when it is 2-3 closer), the fifth (the chest) bobs 0..3 up (go when it is all the way
  down). The ink mist (feet under 12.6 over the pit) puffs you onto the last island you reached. Clouds give no grip (`noGrip`, ice too).
  Bots, 12 tries at 60 · 20 fps: flying straight on 0 · 0 (not even island 1), hovering with no timing 1 · 2, skilled 12 · 12 (about
  16 s), Boomwing and a Bug 12 · 12; without Fly (walker, climber, on foot, a Bug climbing a cloud's side, flier -> climber) 0.
- **The Sluice Gate (Swim, `src/sluice.js`)** north-west of the Drip Tower: a gold plate by a pond opens the gate at the end of a
  water-filled channel under a glass roof; stepping off, it lowers row by row (three lights on the plate's post and over the gate go out;
  the bottom row shuts at 5.6 s). Swim creatures dive (look down) and swim fast under water (`BE_SWIM` 1.7, kicks: tap Swim! or Jump);
  everyone else paddles. Kelp in the middle of each stretch (x 0.35), bubble jets along the outside (+3.2). Bots, 6 tries: skilled 6 · 6
  (3.4-3.8 s), a Bubble creature (Fly + Swim settles onto water and dives) 6 · 6, straight through the kelp 0 (7.2 s), without Swim
  (walker, on foot, flier, climber, a flier that sinks as a walker) 0 (8.3 s at best).
- The hook got `ACTS.fly` (hold Fly! = rise) and `ACTS.swim` (a tap = a kick); the creature you are under water gets the Sunken City's
  blue-green fog (main.js). Not yet: kind help, Easy / Hard (step E), the guide and "Where to go".
Each a skill game, never a key: easy to understand, hard to master; bots with the real Player prove a naive kid with the ability fails,
a skilled one wins, and no creature without it (or a mix through Swap) gets in, at 60 and 20 fps. The obvious shortcut must never
win (CLAUDE.md). Charm and Sense must be real timing / memory games or be dropped. Places hold extras (chests, secret patches,
shortcuts), the main way stays open to everyone.

**E. Later:** Easy / Normal / Hard (`difficulty.js`), kind help, play together (a friend sees your creature), the guide and "Where to
go" for ability places.

## 4. What must not break

- Saves: only ids are stored; never rename an id. `cleanCreature`, trades, duels, the box, the Book all key on ids.
- Outside chapter 3 nothing changes in how anyone moves; riding keeps its own list (only spectrafin's kind changes).
- Gyms, Bosses and Picture Worlds that use a redesigned creature keep it by id (e.g. the Electric gym's Voltwing and Joltail, the Fire
  gym's Flarehawk, the Water gym's Gullop, Wobbleland patches): check the battles still look right.
- Saturnowl (the Cube Planets Boss's giant) is not redesigned.

## 5. Weak spots to keep an eye on

Freeze has one type; Grass's Climb and Time's Dash are weak fits; Sense and Charm need real skill games. Trimming to 15 would
drop Freeze and fold Lift into Mind's Sense.

## 6. Decided (2026-11-13)

1. **Names:** section 2.
2. **Normal keeps Push.**
3. **The guardian (Custom):** it is the only Custom creature a player can have, so its abilities may come from its own design: it
   has **Fly when its parts fly** (wings or the cloud: guardiankit `flies`), plus **one ability you choose** on the drawing board (a
   new row of ability chips; saved in the design, `cleanDesign` keeps it; the rematch redesign may change it). Built in step B.

## 7. Owner 2026-11-14 (after step A)

- Renamed: Dash -> **Sprint** (going fast), Hide -> **Sneak**, Zap -> **Power** (its first name: making a machine work).
- Time loses Dash and gets **Rewind** (a new ability): a place where it is already too late when you walk in (the bridge falls, the
  door slams the moment you enter); only turning the last moments back gets you through. Sprint = you can make it if fast enough;
  Rewind = nobody can, it already happened.
- Grass keeps Climb; a better Grass ability is welcome, but ask the owner first.
- **Every ability must solve something no other ability can** (owner: "how could Bounce solve something Fly can't?"). Review in
  progress: the proposals and the open questions are in the chat of 2026-11-14 and on the map page.
- Later the same day: Zap stays **Zap** ("Power" could be misread). Bounce is dropped (nothing it solves that Fly cannot); Ball gets
  Push (kicking = pushing), Surprise proposed Charm. **Swim = fast in water** (up a waterfall, against a current; anyone can already
  dive), Freeze = water you must not touch (freeze a path, walk on top). **Pass Through** stays for Ghost (maybe Portal), to be
  told apart from Squeeze (proposal: Pass = no opening at all, Squeeze = a crack); Dream and Mirror need their own. Lift = something
  you see but can never reach (a cage, behind glass). Open: Climb vs Fly (the owner never liked the wing-folding rule; it is no
  reason). Proposals: Grow for Grass (roots split cracked stone, Push then only shoves), Heal for Pixie / Cozy / Food. Kick, Reflect
  and Portal as abilities: no (Portal "almost a cheat code").
- Confirmed (2026-11-14): Grow for Grass (with Climb), Heal for Pixie / Cozy / Food, Charm for Surprise, Pass Through for Ghost,
  Portal, Dream and Mirror. **Climb vs Fly holds with no exception:** flying rises only `RIDE.sky.cap` 6 over the floor right
  below you (player.js `fly`, `floorBelow`), so a sheer wall taller than 6 in one face needs Climb; a stepped slope can be flown
  ledge by ledge. **Pass Through** only through faded walls (half-erased pencil walls, solid to everyone else). Open: Swim vs Freeze.
- Swim and Freeze (owner): **Swim = speed in water** (a swim race, catching a fast swimmer, an underwater gate before it shuts; no
  currents, no waterfalls). **Freeze = moving water stops**: a river's current, a waterfall turned into an ice wall that a climber
  then goes up (two abilities together). The fly cap is measured from the one block column right under your middle
  (`floorBelow`), so over a tall building you are 6 over its roof, but you can never get there if its wall rises more than 6 over the
  ground you fly from: you meet the wall first. The same in chapters 1 and 2.
- Voltwing keeps its small wings (owner 2026-11-14): a look only; it has no `flies` and never flies.
