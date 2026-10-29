# 🫧 Bubble type and the Fizzing Well (plan, not built yet)

Owner, 2026-10-28: picked from the "last three stars" ideas in `ROADMAP.md`; "I like both plans" (this one and
`plans/cube-planets.md`). The Knight's Castle is being built in another session at the same time, so this plan is
written to **stay out of its way** (section 9). Task number: give it the next free `T` number when it is built; this
file has no number on purpose, so it never clashes with the Knight session's plan.

**Build this in a fresh session.** Read first: `CLAUDE.md`, `STORY.md` "The Picture Worlds", `plans/T40.md` (the
Picture World kit: `pictureRealm`, `buildWayBack`, `placeBoss`, `placeCrew`, live parts, `Mover`), `plans/T43.md` (the
house style for a skill-game world: three games, never a fail, help after misses, harder rematch), `plans/T41.md`
(a world with its own movement: diving) and `src/comingsoon.js` (the preview switch).

## The owner's rules this plan follows

- **The way to the Boss is a fun, unique skill challenge** (owner 2026-10-27). Aim, dexterity, timing and direction
  beat puzzles. **Never repeat the same kind of challenge in another world.**
- Skills already in the game (do not reuse as the main idea): hold-and-let-go power (Kick!, Fire!, the Atlantis lunge,
  probably the Knight's catapult), letting go at a swing's phase (ropes, piñata, baskets), leading a moving target
  (rowboats, darters), driving with momentum (kart, bumper cars), steering a path while chased (Draw!), standing where
  a thing lands (Jack Catch), bouncing and steering in the air (Balloon Bounce), lanes to a beat (Gold Ring Ride),
  spatial momentum (Portal House), sneaking, memory, logic (gyms).
- **This world's three new skills:** making your own way as you go, moving a thing you do not hold (nudging), and
  staying up with taps (a rhythm flier). **No hold-and-let-go anywhere** (owner: yes, leave it out).
- Never a fail: a fall or a pop puts you back a little, a missed try simply starts again, `fairHelp`-style help after
  two misses, a rematch is harder (`hard`).
- Works on an iPad with the joystick, Jump and the one action button. Text short and kind.
- **Ships closed:** only `?preview` (and tests) open it until the owner has played it (section 8).

## What the child does

Steps out of a picture frame in the Swirl into the bottom of a huge, round, fizzing well: soda-pop colours, foam
ledges, glittering walls, bubbles drifting up everywhere, the sky a bright circle far above. **The whole world is one
climb, from the foam pool at the bottom to the rim at the top**, where **Captain Suds**, a soap-bubble walrus, sits
behind three shimmering shield bubbles. Bubble Bee, the wand-maker on the first ledge, hands over a **bubble wand**.
On the way up there are three stretches, each a skill game, each with one of Captain Suds' crew at its top:

1. **Bubble Stairs**: a shaft with nothing to stand on. Blow your own steps and climb them.
2. **Float the Ducklings Home**: three sleepy rubber ducklings must go back to their nest. Bubble them and puff them
   along through a thorny garden of coral and currents.
3. **The Chimney Ride**: climb into a big bubble and fly it up a twisting geyser chimney, tap by tap.

At the rim, Captain Suds' shields are popped by bubbles you send up on the wind. Then the battle, and the star.

---

## 1. Why the Fizzing Well and not a bath lagoon

The roadmap said "Bath Lagoon". A giant bath is the Giant House again (a home at giant size), and a lagoon is the
Pirate Seas and Atlantis again (water). The Dream is flat islands. **The well is vertical:** every other world is about
going across; this one is about going **up**, and the bubbles are what make up possible. It also fits the story: the
Scribble's scribbles let the fizz go flat, so the bubbles stopped rising; the child's wand gets them rising again (a
line for `STORY.md` when built).

## 2. The world (terrain as data, Node-runnable: `src/bubbleland.js`)

- **Size and height.** Every world is 48 blocks tall (`WORLD_H`, it also sizes the light buffer), so the climb is
  **about 40 blocks of height spread round a spiral**. Map about 160 x 160. The well: a round wall of radius ~70 at the
  map's edge, the foam pool at the bottom (y 2-4), a spiral of foam ledges and terraces winding up the inside of the
  wall, the rim walk at y 42-44 with the open sky above.
- **Three stretches stacked on the spiral:**
  - Bubble Stairs: y 6 -> 20, two shafts (a wide easy one, then a narrow one with drips and side vents).
  - Duckling Garden: a broad terrace ring at y 20-24 (the flattest, widest part: room to nudge things about).
  - Geyser Chimney: a hollow column from y 24 to the rim, twisting inside the well wall (open on one side so the camera
    and the child can see the way).
- **Looks:** pastel soda colours, foam-white ledges, glitter on the walls, slow bubbles rising everywhere (instanced
  sprites, like the Swirl's puffs; decoration only, never solid). A gentle bright sky (`look.still`).
- Each stretch has a `world.rests` spot (a lost crew battle keeps you there), a keep over every gadget, `world.nooks`
  for wild creatures, and a way back (`buildWayBack`) at the bottom **and** at the rim (like the Sketchbook's two ways
  back), so a finished climb never has to be walked down.
- `bubbleAim` (TERRAIN_AIMS): the next unfinished stretch, then its crew member, then Captain Suds, then the way back.

## 3. The wand and bubbles (pure rules: `src/bubbles.js`, no imports, fixed 1/120 s sub-steps)

- **Blow!** (the big button, E, a click, a tap on the screen; one press, **no hold**): a bubble appears 1.6 blocks in
  front of the eyes, at eye height, the way you look.
- A bubble **rises** slowly (0.8 blocks a second), drifts with any current it is in, and **pops after 4 s**.
- **Standing on a bubble:** it is a thing that carries you (like the bottle cap: the player box rests on its top). It
  sinks 0.3 a second while you stand on it and pops 1.5 s after you landed. A soft wobble and a squeak warn 0.5 s
  before a pop.
- **At most 2 bubbles at once** (a third pops the oldest). The wand has 6 puffs of soap; **soap flowers** on the ledges
  refill it (walk through one). Soap is shown as six dots on the score chip.
- Things that pop bubbles: drips from the ceiling (closed-form schedule, a shadow shows where the drip lands), thorns
  (coral spikes), and touching a wall for more than 0.2 s.
- Wind vents (`world.lifts`-style boxes, but sideways too) push bubbles; the player is pushed only while standing on
  one.
- All of it is a closed form of the part's own clock plus the fixed sub-steps, so 60 and 20 fps give the same climb.
- Bubbles are meshes (one `InstancedMesh`, a shiny rainbow shader), never blocks, never saved or sent.

## 4. The three games

### 4.1 Bubble Stairs: make your own way

- Shaft 1 (wide, calm): blow, hop on, blow the next one a little higher, hop. The trick to learn: blow while standing
  on a bubble, look up a little so the next one is higher. Soap flowers every few steps.
- Shaft 2 (narrow): side vents blow bubbles sideways (blow on the upwind side), drips pop bubbles (blow between the drip
  shadows), one gap where you must blow two bubbles quickly and use both.
- A fall lands on the last foam ledge you stood on (never back to the bottom).
- At the top, **Wanda Wand** (crew) waits. The stretch counts as done when you reach her ledge: `beaten` key
  `pw:bubble:stairs`.
- Help after two falls from the same ledge: bubbles last 1 s longer and drips slow (x0.8), shown with a kind toast.

### 4.2 Float the Ducklings Home: nudge without holding

- Three ducklings sleep on islands of the Duckling Garden. **Blow!** at a duckling (within 2 blocks) and a bubble
  closes round it; it floats up to waist height and drifts.
- You cannot carry it. **Puff!** (the same button while a bubbled duckling is within 2.5 blocks in front of you) gives
  it a small push the way you look. It has momentum and slows only slowly (like a puck), so a push too hard sends it
  past the nest.
- Currents (slow streams of tiny bubbles) carry it; thorny coral pops its bubble (the duckling plops gently back onto
  its own island, sleepy, never hurt); the nest is a ring of foam it must stop inside for 1 s.
- Duckling 1 goes straight, duckling 2 must cross a current (push across it, aim upstream), duckling 3 goes round a
  thorn maze where small taps beat big pushes.
- Each duckling home is a `beaten` key `pw:bubble:duck1..3`, saved at once. **Mother Duck** (crew) at the nest says
  thank you and battles when all three are home.
- Help after two pops of the same duckling: currents x0.7 and the duckling's friction x1.5 (stops sooner).
- Pure rules: `nudge(state, dir)`, `stepDuck(state, dt, currents, thorns)`, the nest check; a stand-in robot player in
  the spec ("skilled": short taps toward the nest; "pusher": always full pushes) proves skill matters.

### 4.3 The Chimney Ride: stay up with taps

- At the bottom of the chimney, **Ride!** (the big button near the big bubble): you step inside it (a `carry` object,
  like the Funfair's cars).
- The bubble **always sinks slowly**. Each **tap** (Jump, the big button, a tap on the screen) is a puff: up 1.4 blocks
  over 0.3 s and a little push the way you look. The stick steers a little too. So it is a rhythm: tap, tap, wait, tap.
- The chimney twists up: rings of spikes with a gap to fly through, a fan that blows you sideways, fizz stars to
  collect (checkpoints and a cube each the first time), a slow spinning bar near the top.
- A spike pops the bubble: a soft puff and you are back inside a new bubble at the last fizz star. Never a fail.
- Reaching the top lands you on the rim: `beaten` key `pw:bubble:chimney`. **Captain's Mate Fizz** (crew) waits there.
- Help after two pops at the same part: the bubble sinks slower (x0.75) and the spike gaps are 1 block wider (drawn
  with `setLive` or as mesh only, never a world edit).
- Pure rules: `rideStep(state, dt, { tap, stick })`, closed-form hazards; the spec flies it with a robot that taps on a
  rhythm, at 60 and 20 steps a second.

## 5. Captain Suds (the Boss)

- A creature Boss (a giant Bubble-type walrus, `model` scale ~2.2, top level 63 like the other wave 14-15 Bosses) on a
  foam throne at the rim, inside **three shield bubbles**.
- **Gate:** the three stretches done and the three crew beaten (`crewLeft`, as every Picture World Boss with helpers,
  owner 2026-10-27).
- **The shields:** three up-draught vents rise round the throne, their wind visible as streams of tiny bubbles. A
  bubble you blow into a vent is carried up and round and hits a shield if you blew it from the right spot (each vent
  curls a different way). Reading the wind, a little of every stretch. Three hits, the shields pop, he battles. This is
  the finale, quick to do once the climb is learnt (no timer).
- Won: the star, the Wizard's note (`ui.celebrate`), the shields come back for a rematch; a won battle clears the
  `pw:bubble:*` keys (like the Stadium's goals), so a rematch is a new climb, harder (`hard`: bubbles last 0.5 s less,
  more drips, faster currents, a faster sink in the chimney).
- Lost: you stay at the rim rest (`lose: 'stay'`, healed).

## 6. The Bubble type

- Type id `bubble`. Creatures (7, the owner wants unique shapes, each family its own builder in `shapes.js`):
  - **Duckling > Admiral Duck** (a rubber duck; the big one wears a captain's hat): shape `rubberduck`.
  - **Spongelet > Spongecrab** (a sponge with claws, squeezes out bubbles): shape `spongecrab`.
  - **Wisplet > Wandfairy** (a bubble-wand fairy, a ring for a body): shape `wandfairy`. Rideable? No: it is tiny.
  - **Fizzbomb** (7th, single stage, a fizzing bath bomb that bounces): shape `bathbomb`.
  - Every model wears `gear: 'shine'`-like **soap film**: one merged mesh of 2-3 small rainbow bubbles floating round it.
- **The wild look:** wild Bubble creatures float inside their own bubble, bobbing (`gait: 'float'`, closed form like
  `peek`/`gift`). Walk into the bubble or tap it: it pops (a soft `pop` sound) and the battle starts. They live only in
  this world's `spawns` (`nook`-style spots on the ledges), rare like every Picture World (`wild: { max, every }`); the big
  evolved forms only after the first stretch (`wildafter.js` `AFTER_CHECKS.bubble`).
- Moves: Bubble Pop, Soap Slide, Foam Hug, Fizz Up (raise), sigs Rubber Ducky Rush (Admiral Duck) / Wand Waltz
  (Wandfairy), big moves for the type's `BIG_LEVEL`s. Its own `TRAVEL` / `IMPACT` / `FX_COLORS` entries and an
  `fx:bubble` sound. Never name a move like a sound effect.
- Chart: its own row plus separate lines (never edit an old row; a defender may be weak to at most 5 types). Suggested:
  Bubble hits fire, rock, toxic; is weak to electric, metal (pins), pirate (hooks); resists water. Check against the
  chart rules when built.
- `look: 'bubble'` for the crew in `npc.js` (a bubble-wand on the back, a little soap-foam hat).

## 7. Blocks: very few new ids (read this before adding any)

**Block ids are almost used up.** `world.data` is a `Uint8Array`, so ids stop at 255. The Castle (T49, built
2026-10-28) took **254** (knight wool) and **182** (`HEDGE`). Free now: **255** and the reserved **137-139, 147-149, 183,
249** (8 ids). They are shared out like this (2026-10-28), so the three worlds never pick the same id:

| Ids | For |
| --- | --- |
| 255 (wool), 147, 148 | Bubble Well: the bubble wool, `FOAM`, `FIZZ_WALL` |
| 149 (wool), 183, 249 | Cube Planets: the gravity wool, `PLANET_ROCK`, `STAR_GRASS` |
| 137 | wave 17, the Custom type's wool |
| 138, 139 | spare (the last two ids in the game) |

- This world takes **only its three**: 255 for the type's wool (required by the gym/roof code, `WOOL_ID_OVERRIDE`),
  147 and 148 for two blocks. Do not take another world's row; the spare two need the owner's yes.
- 255 is safe as a block id: nothing in the code uses it as a "no block" mark (checked 2026-10-28), but the `blocks`
  spec's id checks (it allows 254 for the knight wool) need 255 added.
- Everything else is **existing blocks** (white wool / clouds / quartz-like stone for foam, coloured wool for the
  soda walls) or **meshes** (bubbles, drips, ducklings, the shields, vents' streams). The Swirl tint trick
  (`swirlTint` in `caves.js`) could tint existing blocks pastel inside this world only, if the look needs it.
- If that is not enough, the real fix is a separate task: widen block ids to 16 bits (`Uint16Array` data, edits, the
  multiplayer `block` message; the atlas already has room for 1024 tiles). That is a big change with its own plan and
  tests; do not start it inside this task.

## 8. Shipping closed (the preview switch)

The owner wants to play it first. The switch already exists (the Castle added it, T49): `LATER` in `src/comingsoon.js`.
Add the id there, nothing else changed in it:

```js
export const LATER = ['castle', 'bubble']; // Cube Planets adds 'gravity'
```

`worldOpen(id)` is false for it unless `?preview` or the test flag (`window.__pcWave15`) is on, and `pictureworlds.js`
keeps a closed `LATER` world's frame looking like the old secret one. While closed: the frame stays under its cloth, the
guide never points into it, and the save keeps nothing from it (the realm can't be entered); check it the way the
Castle's spec does. Opening it later for everyone = adding the id to `OPEN_NOW` (a one-line commit, like the Funfair's).

## 9. Staying out of the Knight session's way

- **Picture World slot:** `PICTURE_WORLDS` has `secret4`, `secret5` left (the Castle took `secret3`, T49). **Bubble
  takes `secret4`**, Cube Planets takes `secret5`. (The Portal Lab idea, `plans/T47-portal-lab.md`, named `secret4`
  too; it gives it up and has no frame until there is one.) Rename the entry's id to `bubble` (allowed:
  no save can hold a secret world's star, as `doodle` and `atlantis` did) and keep its frame colours.
- **Block ids:** section 7.
- **Shared files** both sessions touch (`blocks.js`, `species.js`, `shapes.js`, `realms.js`, `pictureworlds.js`,
  `pictureboss.js`, `fxrecipes.js`, `sound.js`, `README.md`, `CLAUDE.md`): add new things in their **own sections at
  the end** (`/* ==== Bubble ==== */`), never re-order or reformat existing lines, so the merge is only appends.
- Merge `main` in before starting and again before pushing.

## 10. Files

| File | What |
| --- | --- |
| `src/bubbles.js` | pure: `BUBBLE` numbers, `blow`, `stepBubbles` (rise, drift, pop, standing), drips, vents, `nudge` / `stepDuck`, `rideStep`, `shieldShot`, `bubbleHelp(misses)`, `HARD` |
| `src/bubbleland.js` | terrain as data (Node-runnable): `WELL`, `SPIRAL`, `STAIRS`, `GARDEN`, `CHIMNEY`, `RIM`, `bubbleLand(world, def)`, `bubbleAim` |
| `src/bubblelive.js` | `BubbleLive` = `LIVE.bubble`: wand, bubbles mesh, ducklings, the chimney ride (`carry`), shields, chip, `near` / `use` (Blow! / Puff! / Ride!), `tap`, `battleEnded`, `manual` + `step(dt)`, `info()` |
| `src/bubbleprops.js` | the models: bubble shader, ducklings, nest, vents' streams, shields, wand in hand; `tests/bubble-preview.mjs` photographs them |
| `tests/bubble.mjs` + `tests/bubblecheck.mjs` | the spec (below) and the terrain check (stand-in world, walk graph with bubble edges) |

## 11. Tests (spec `bubble`)

- **data:** 7 creatures, 4 own shapes with the soap film, moves, big moves, fx, sound, chart (no old cell changed),
  blocks.
- **land:** three seeds in Node: only inside the map, every stretch reachable **only** with the wand (the walk graph
  without bubble edges cannot climb; with them it can), nobody stuck, keeps, both ways back, nooks.
- **rules:** pure bubbles at 60 and 20 steps a second the same; a skilled robot climbs both shafts, a robot that blows
  straight ahead never climbs shaft 2; the duckling robots (skilled wins, full pushes lose duckling 3 without help, win
  with help); the chimney rhythm robot gets through, a no-tap robot never does; help after misses.
- **play:** the whole loop in the browser (the wand, a fall onto a ledge, ducklings saved and reloaded in a fresh
  browser, the chimney, the crew, the shields, Captain Suds, a lost battle stays, the star, a rematch is new, both ways
  back).
- **closed:** without `?preview` the frame is covered and the realm can't be entered; with it, it opens.
- **ipad:** Blow! / Puff! / Ride! on the big button, chimney taps on the screen; two browsers (a friend follows, each
  climbs their own bubbles).
- Screenshots `bubble-*.png` for the owner.

## 12. Open questions for the owner (ask before building)

- Name: "Fizzing Well" and "Captain Suds" are working names.
- Should the ducklings be the rubber-duck creatures of the type (catchable later), or plain toys?
- Is 40 blocks of climbing enough, or should the well be taller (that needs a taller world: a bigger change, see
  `plans/cube-planets.md` section 2)?

## Built (2026-10-28): what the builder did differently, and why

- **Names:** the world is the **Bubble Well** (frame, realm, Book); "fizzing" stays in the words. Captain Suds kept.
- **Creatures** (checked against the game: crabs and fairies already exist, so no Spongecrab / Wandfairy): **Squeaklet > Quackmiral**
  (rubber duck, admiral's hat and a little duck fleet, `rubberduck`), **Suddly > Lathotter** (a sea otter floating on its back with
  a bar of soap; foam beard and sailor cap, juggles soap, `bathotter`), **Hippip > Bathemoth** (a little hippo with a bubble on its
  nose; a huge one with a bathtub on its back, rideable on water, `tubhippo`), **Fizzbomb** (bath fizzer, `bathbomb`). Soap film gear
  `film`. **Captain Suds is a giant Lathotter**, not a walrus (a walrus is too close to Sealbop, the beach-ball seal).
- **The ducklings are sleepy Squeaklets** (the type's own baby: no rubber duck existed in the game), not catchable in the garden.
- **Chart:** Bubble hits fire, toxic and **tiny** (trapped in a bubble) instead of rock (rock is already weak to 5 types); resisted by
  metal, grass, bubble; weak to electric, metal, pirate; resists water and fire.
- **Kind help:** none of the plan's own numbers. `bubbleHelp(misses)` is only `kindHelp` mapped onto levers (listed in kindhelp.js).
- **The wand:** Bubble Bee lends it as soon as you arrive (no talk needed). Bubbles you stand on **sink and pop 2 s after you land**;
  **Jump on a bubble = Bounce** (2.1 high), which is what makes chains of bubbles climbable. A faint ring shows where Blow! puts the next
  bubble. The fall rule: only a fall **from a bubble** puts you back on your ledge (walking off a ledge on purpose is allowed).
- **The well's shape:** a floor, a bench (shaft 1 in front of it), the plateau with the Duckling Garden and the chimney, the rim. The
  plateau **overhangs the bench** and a visible **fizzy breeze** blows bubbles away from the cliff, so the narrow shaft is the only way
  up (the plan's "only with the wand" check, `bubblecheck.mjs`). The whole map is a keep: no building, no riding.
- **Fizz lifts** (not in the plan): after the stairs a lift runs from the floor to the plateau, after the chimney one to the rim, so a
  saved stretch is never climbed twice (also for a star holder).
- **Puff! strength** comes from how far you stand (close = big puff), since a one-press button cannot say how hard.
- **The chimney's bar** is an arm from the middle to the wall (a clock hand) so there is always a way past; the ride's stars give a
  cube the first time **per visit**; resting at the bottom 4 s hops you out.
- **The shields:** each vent turns your bubble round by its own curl and it flies out the side it ends on; saved keys
  `pw:bubble:shield1..3`, cleared with the others on a won battle.
- **Duckling 2** has thorns where the stream meets the rim, so the stream matters (the stream alone could just be waited out).
- **Getting onto a bubble (owner 2026-10-29: "I could never jump on a bubble"):** the first build only caught you when your feet came
  down through a bubble's top, while a new bubble rose at once: one blown a little down was out of a hop's reach within a moment, and one
  blown under your feet mid-jump was already above your feet, so it passed you by. The robot climb never saw it (it blew and jumped in
  the same frame at an exactly computed angle). Now a bubble waits 0.6 s before it rises, one blown at the floor sits on it, your feet
  inside its top half also land you on it (never the one you just stepped off), one blown under your feet in the air catches you at once,
  the aim ring turns green when a hop reaches it, and the stick waits 0.5 s after landing (a child still holding W stays on). The spec's
  `real` part plays it with real keys and taps through the game's own loop.

## Rework 2026-10-29: easy to understand, hard to master

The owner played it: "Bubble games are way too easy now. Especially stairs and duck ones. Stairs: I could just jump and build under me,
just like how I did with the saucer gym or sky gym before in chapter 1. No challenge. Duck was a bit more interesting but not really much.
The Chimney Ride was a good game, but it wasn't clear to understand in the beginning (the bubble didn't look like a different,
nice-looking bubble). I didn't understand the last one with the 'fizz bubble send' (the shields). It should be easy to understand, hard
to master!! Never forget this rule!" The world, story, type, creatures, crew, Boss, keys, lifts, ways back and the `?preview` closure
stay; the four games changed like this.

**1. Bubble Stairs: "Blow a bubble ahead, hop on, hop again!"**

- **Why the pillar worked:** Blow! went where you looked, and a bubble blown under your feet in the air caught you (the `under` rule of
  "Getting onto a bubble"). Jump + look down + Blow!, again and again, was the chapter-1 sky-gym pillar.
- **Now:** Blow! puts the bubble at **one fixed spot**: `BUBBLE.ahead` 2 blocks ahead of your feet, the flat way you face, its top just over
  your feet (looking up or down changes nothing; a green ghost bubble shows the spot). It works **only with your feet on something**
  (the ground or a bubble); in the air nothing happens and a word says "Land first!". So every bubble is two blocks away from the last:
  no column, ever. A bubble waits `hang` 0.3 s, then **floats up** at `rise` 1.3 blocks a second: hop at once and you gain about half a
  block, let it float up a moment and you gain about 1.2, wait too long and it is out of reach (a word says "hop a little sooner").
  The bubble you stand on pops `stand` 1.6 s after you land, so it is a rhythm: blow, watch, hop. Two bubbles that touch both pop
  (blowing twice in one place wastes soap). Six puffs a chain; standing on any ledge fills the wand again.
- **Why it is hard to master:** the gain per bubble is the timing. Shaft 2 (8 blocks) needs about 1.1 a bubble from six bubbles in its
  short length, so only well-timed hops make it; the drips fall over its west half and the side wind pushes bubbles toward them, so
  you blow on the east side and hop a little sooner in the wind.
- **The tutorial:** shaft 1 got a low foam step (`STEP1`, stand at 7): from the floor one bubble and any hop gets you on it (the hint
  read literally works). From the step the bench is straight ahead but too close for a bubble: turn to the side, blow, hop, turn back,
  blow, hop, hop onto the bench (the first trick: the way you face decides where it goes).
- **Proved with kids that only press keys** (`tests/bubblebots.mjs` `makeKid`, real Player in the page, 60 and 20 fps): the pillar kid
  never leaves the floor or the bench; a kid who hops the moment it blows never gets up shaft 2 (it gains ~0.5 a bubble); a spammer
  (random waits, wobbly aim, double blows) got up 0 times in 8 runs of 40 s; a skilled kid climbs both shafts every time (~4 s and
  ~7.5 s); the first-time kid gets onto the step at once. The spec's `real` part does it with real keys (E, W, Space, mouse moves).

**2. Float the Ducklings Home: the same nudge, more to read**

- A **yellow arrow** on the floor shows where a Puff! sends it and how far it glides (`glideOf`).
- **The gusty gap** (`GUSTS`): between the thorn pen's rows a lane where little bubbles gather (0.8 s) and then a gust blows south
  toward row A for 1 s, every 4.5 s. Duckling 3 must cross it in one quick, strong puff right after a gust.
- A duckling's bubble lasts `DUCK.life` 45 s (it wobbles thin the last 6 s); then it **wakes and waddles home** to its island (blow
  again to catch it on the way). Both a thorn and the timer count as misses for the kind help.
- Bots (8 moments of the gust's beat, 60 / 20 fps): the skilled player gets all three home with no pop (duckling 3 in ~25 s); big puffs
  straight at the nest only work for duckling 1; a player who knows the way but ignores the gusts got duckling 3 through 4 times in 37
  tries (11 %).
- Once all three are home, Blow! by the nest sends one back to play again just for fun.

**3. The Chimney Ride (the owner liked it): now it looks like what it is**

- The ride bubble is big, golden-rainbow, glowing and pulsing, with a foam seat and a little rubber duck in it, and a **"Ride!" sign**
  with an arrow bobbing over it. The first words: "Tap Jump to float up. Fly through the gold rings!"
- The rings are fat and gold; **the next one pulses** and has a soft beam of light under it. The first ring is right over the start
  (the obvious first gap). Rules unchanged; the spammer now gets through ring 1 and always pops on ring 2.

**4. Captain Suds' shields: a bank shot** (replaces the fizz vents, which nobody could read)

- One line: "Stand on the gold pad, bounce your bubble off the pink cushion into the shield!" A foam fence (blocks) hides the throne
  from the balcony, so a straight shot always splats. On the round's **gold pad**, Blow! sends a bubble flying flat the way you look
  (one press, no hold); it bounces off the pink soap cushion like a ball off a wall (`bankShot`: fixed 1/120 s steps, worked out at
  once). A **dotted line** shows its way to the first bounce and a short stub after it (`aimLine`).
- Round 1: a cushion near the pad (an 8 degree window); round 2: the cushion across the rim (5 degrees); round 3: a cushion that
  **slides** up and down (the line shows the bounce only while it will be there: wait, then blow).
- Unique in the game: nobody else banks a shot off a wall; it is not hold-and-let-go, not leading a moving target.
- Bots: straight at the shield 0 hits; random shots 1-3 %; a player who follows the dotted line's bounce stub 5 / 5 in every round;
  a hand that wobbles 3 degrees always hits round 1 but misses rounds 2-3 now and then.
- Keys `pw:bubble:shield1..3` keep their meaning (a popped shield stays popped), so old saves lose nothing.

**Shared:** kind help only through `bubbleHelp` (= `kindHelp`): stairs rise slower, ducklings' winds weaker and bubble longer, ride as
before, shields bigger and the slider slower; `HARD` (rematch) makes them faster / smaller. Every game replays for fun once won
(the stairs and the ride by nature, the ducklings from the nest, the shields with `ForFun`).
