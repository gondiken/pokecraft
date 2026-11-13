# Chapter 3: being your creature, and the Ways (plan + the first test, 2026-11-12)

Your son's wish: **play as the creatures outside battles too, like riding.** The idea was dropped once (`plans/chapter3.md` section 2)
for two reasons:

1. **Overlap:** one creature's ability solves another's place (a climbing place is solved by any flier).
2. **Riding already gave bodies their movement** (fly, swim, run), so "why can't Boomwing fly when it has wings?"

This plan tried to solve both. **The first test is built (?preview, Wobbleland only): see "Built" (section 7).**

> **STATUS 2026-11-13 (later): SETTLED. The build plan is `plans/chapter3-abilities-build.md`.** Earlier status: UNRESOLVED. The owner is not happy with where the design is. Read section 10 first** (the whole design
> talk, every idea tried and why it was rejected, the open question and what to do next). Sections 2-4 and 9 are earlier thinking
> that the owner has since pushed back on; they are kept as history, not as decisions.

## 0. After the owner's first play (2026-11-12, later the same day)

- **You are your creature; one Swap button.** The squad bar is gone. In chapter 3's lands you are your creature by itself (owner: "kids
  will never want to switch to me anyway"); "🧍 Be me" / "🐾 Be my creature" is a button in the pause screen (R on a keyboard), so no
  extra touch button. Swap (F, or the Place button: nothing is built in Wobbleland) goes round your first three; 1 2 3 on a keyboard. 🐾
  marks the creature you are in the team list. The camera choice is V and the pause screen.
- **The camera flashed** when walking W / A / D (not S): the "never lag through a wall" line copied your head before reading the way
  back, so every time you walked away from the camera it landed on your head and slid out again. Fixed; the spec now walks W / D / A / S
  and checks the distance never drops.
- **Speed made sense:** in chapter 3's lands creature mode IS riding: a creature moves exactly like riding it (riding.js `RIDE`: a land
  body 7 / 9.5 and its jump, a swimmer like the water ride, wings like the sky ride). R there no longer rides.
- **No swap rule.** It was extra code for nothing: each place judges the body you are every frame (a Fly creature that swaps to a
  walker over the ink falls in), so swapping is allowed any time, also in the air.
- **"Too windy for Boomwing but not for bubbles?"** The owner is right: any rule "only these TYPES can do this BODY thing" will clash
  with some creature's looks, because types and bodies do not line up (Boomwing is Sound with huge wings; a Bubble floats). So the
  storm is now the same for every creature with wings (Boomwing with skill wins too: bots). **Storm Island is a wings place, not a
  type's.** The Fly Way needs a new idea: see section 9.

## 1. Decisions (owner 2026-11-12)

- **What a creature does in the world reflects its TYPE**, with the types grouped into **Ways** (at most 15). Not battle move kinds.
- **A squad of three**: you are one of your first three creatures at a time and can switch (the same three as the scribble fight).
- **Both cameras**: behind your creature (third person) and in its eyes (first person), switchable, like Cube Planets.
- **Chapter 3 only.** Being a creature is allowed only in chapter 3's lands (Wobbleland now). Everywhere else you are always yourself:
  otherwise a Cling creature walks up the Obstacle Course and a flier skips the Bubble Well's climb.

## 2. The rule that ends both old problems: body moves, type masters

- **The BODY is how you move, and it is the same for everyone with that body.** Legs walk and jump. **Wings fly**, everywhere they fly
  today (`flies` in species.js, a sky-ridden creature, or any Fly-type creature): Boomwing flies. The body never depends on the type.
- **The TYPE is a Way: the hard version of one kind of place that only that group masters.** Any creature with wings can fly; only the
  Fly types master a *storm*. Any creature can stand by a wall; only the Cling types climb a narrow shaft.

So Boomwing is never told "you can't fly". It flies across the meadow like always. It cannot do two things, and both have a reason you
can see:

- **Tight places stop every wing** (a shaft, a doorway): "No room to spread its wings here!" That is true for a Drake too.
- **The storm blows back everyone but the Fly types**: "Too windy for Boomwing! Only Sky, Drake, Alien and Bubble creatures fly this
  storm." The ink-wind is drawn (falling dark streaks, a dark cloud), so it is believable.

The same shape works for every Way: anyone may paddle, only Dive types hold their breath for deep water; anyone may stand on earth, only
Dig types go through it.

**Riding stays travel.** A rider is blown back by the storm too ("Too windy to ride here! Be Scalewing to try the storm."). In a Way's
place you must *be* your creature. Riding into a patch still hops you off.

## 3. How a Way's place is made so nothing else solves it

1. **The place shows who it is for.** Every barrier is made of something a child can see, and each Way works on one kind of thing:
   soft earth = Dig, thin see-through bars = Slip through, a crack in a solid wall = Squeeze, a boulder = Push, a wide gap with no walls
   in a storm = Fly, a narrow shaft = Cling.
2. **Two Ways never answer the same question in the same shape.** Fly and Cling both go up, but Fly owns *open air with no walls* and
   Cling owns *tight places with walls*: wings need room, climbers need a wall.
3. **It is a skill game, never a key** (the dropped "keys and locks" idea). Easy to understand, hard to master: a naive kid of the right
   type fails, a skilled one wins (bots prove both at 60 and 20 fps with the real Player).
4. **The main way is always open to everyone.** Way places hold extras (chests, secret patches, shortcuts, later eggs). That gives a
   reason to catch many types and to pick your three before you go, and never locks the story.
5. **A checker proves it** (`tests/waysbots.mjs` now; later a reach search per place): every other Way, and every *mix* of other Ways
   (you can switch), fails; the owner Way wins with skill.
6. **Switching happens only on the ground**, so you cannot chain Ways in mid-air (fly halfway, then cling).

## 4. The 15 Ways (`src/creatureways.js` WAYS; ids append-only)

Every one of the 46 types sits in exactly one Way. Custom (the Wizard's guardian) has none yet: idea, you pick its Way on the drawing
board. The types in each group are a first draft: your son could decide some of them.

| Way | The challenge it beats (its own shape) | The skill (naive fails, skilled wins) | Types |
| --- | --- | --- | --- |
| 🪽 Fly (to redo as Wind, section 9) | a wide open gap in a storm: **now a wings place for everyone** | built: rings of downdraft; hover, go when the next one is calm | Sky, Drake, Alien, Bubble |
| 🧗 Cling | a narrow shaft, walls, (later) ceilings | **built**: drips fall down the shaft; wait in a nook, climb between drips | Grass, Bug, Slime, Parkour, Gravity |
| 🌊 Dive | deep water and its currents | breath runs out: air bubbles along the way, ride the currents, not against them | Water, Pirate, Atlantis |
| ❄️ Freeze | rushing water too wild to swim | freeze a stepping-stone path ahead of you while it melts behind (aim, timing) | Ice |
| ⛏️ Dig | soft earth, buried things | tunnel through soft earth, steer round hard rock and ink pockets; find the chest by its rumble | Rock, Bone, Treasure |
| 📄 Squeeze | cracks, gaps under doors | go flat to slip through; a crack closes and opens like a breath, get through while it is open | Paper, Tiny, Doodle |
| 👻 Slip through | bars, fences, glass | fade through thin walls, but only while nothing is shining on you (move between lamps' beams) | Ghost, Dream, Portal, Mirror |
| 💡 Glow | the dark | already in Glowcap Caves as an edge in fights; as a Way: light the way for a lost creature to follow you | Light, Rainbow, Cosmic |
| 🔥 Burn away | thorns and tangles that grow back | burn a path; it grows back from its ends, so you must keep moving and pick the right gaps | Fire, Toxic |
| ⚡ Power | machines: a lift, a bridge, a door | charge a machine by staying on its pad while sparks drain away; a bridge runs only while charged | Electric, Cyber |
| ⏱️ Dash | crumbling floors, closing doors | a burst of speed with a cool-down: save it for the moment the door starts to close | Racer, Time, Ball |
| 💪 Push | heavy things | push a boulder that rolls on: steer it into the slot without it rolling off (risk: dull without the roll) | Normal, Metal, Knight, Squad |
| 🥷 Sneak | someone watching the way | blend in (Camo) or slip in the shadows (Ninja) past a watcher's turning gaze (like the Shadow Dojo, but as the creature) | Camo, Ninja |
| 🔊 Sense | hidden paths | an echo shows the hidden path for a moment; remember it after it fades | Mind, Sound |
| 💖 Charm | someone grumpy in the way | throw treats at the right moment (when it looks at you) to win it over | Pixie, Cozy, Food, Funfair, Surprise |

Weak spots, honestly: Freeze has one type; Push needs its roll to stay fun; Charm and Sense must be real skill games or be dropped rather
than forced.

**Overlap pairs to watch** (each needs its shape rule and the checker): Fly vs Cling (open vs tight, done), Fly vs Dash (a gap crossed
by speed: Dash places are about *time*, never distance), Dig vs Squeeze vs Slip (earth vs crack vs bars, by the material), Dive vs Freeze
(under the water vs across wild water: rapids sweep any swimmer away), Glow vs Sense (dark vs hidden in daylight), Push vs Power (a
boulder vs a machine).

## 5. Playing it

- **Become one of your three**: the squad bar at the top (🧍 Me, 1 2 3 with each one's Way icon, 🎥). Keys **1 2 3** become one, **X**
  goes back and forth, **V** switches the camera. On a tablet: tap the bar (under the pause and Book buttons).
  `#party-mini` (the team list top left) still opens Team when tapped.
- **The camera**: behind your creature by default; in its eyes with V or 🎥 (remembered on this device). In a tight place (the shaft, a
  doorway) it goes into its eyes by itself, and comes back out after.
- **Fights**: walk into a scribble patch as your creature and it is already out: no Capture Cube; it leads the fight (its place in the
  squad stays, so 1 2 3 swap as before); the camera glides from behind it to the fight camera and back; afterwards you are still it,
  where it fought. Walking in as yourself is exactly as before.
- **Leaving Wobbleland** makes you yourself again. Nothing is saved except the camera choice; after a reload you are yourself.

## 6. Not built yet (the next steps)

1. **Your son plays the test** (Storm Island and the Drip Tower). Questions for him below.
2. **First person shows the body**: paws on the wall when clinging, wing tips in the wind, like the Swirl Wand in front of the camera.
3. **Kind help** for the two places (`kindHelp(misses)`: calmer rings, slower drips) and the Easy / Hard levels.
4. **Play together**: a friend sees your creature, not your person (the `state` message already shows a ride the same way).
5. **The guide and "Where to go"** for Way places, and a sign or look that says which Way a place wants.
6. **The other 13 Ways**, a couple at a time, each with its place in Bumpy Hills (or the next region) and bots; the checker grows into a
   reach search over every place with every other Way and every mix.
7. **Sizes later**: a Tiny or Squeeze creature's smaller box; a big creature's bigger one.

## 7. Built (2026-11-12, ?preview only)

- `src/creatureways.js` (pure): the 15 WAYS, `wayOf`, `bodyOf` (wings / cling / storm), `wingRoom` (no wings with a wall on both
  sides), `bodyStep` (a winged body flies with the sky riding physics where it has room, walks where it has none).
- `src/player.js`: `be` and `clingStep` (push into a wall to climb at 3 blocks a second, let go of the stick to hang, push any other way
  to step off, Jump lets go; ice cannot be gripped; a drip's knock lets you fall until you stand). Everywhere else `be` is null and
  nothing changed (the `jump` and Wobbleland Node checks give the same numbers).
- `src/wayland.js` (Node-runnable): the area in Bumpy Hills just north of Puddle Meadow (flattened; the meadow untouched):
  - **Storm Island** (Fly): a chest on an island in a lake of the Scribble's ink (radius 23). Touch the ink = a puff back to your last
    dry spot. Three rings of ink-wind round the island blow straight down while on (3 s cycle: 1.8 s on, a 0.4 s flicker before).
    Their times are set (`ringOffsets`) so flying straight in at full speed always meets one that is on.
  - **The Drip Tower** (Cling): a 5 x 5 tower of ice (no grip outside), a one-block shaft inside it from the door up through the roof,
    three nooks on its east side, a chest on the roof. A drip every 3.4 s falls down the shaft; it knocks a climber down to the bottom.
  - `Trials` = the places' rules each frame after you moved (clock = summed dt, still while paused).
- `src/being.js`: being your creature (the squad bar, keys, cameras, the model, swaps only on the ground); `src/wobblelive.js`
  `WayPlaces` draws the rings, the storm cloud and the drips and says the toasts; `src/scribble.js` the fight entry as your creature.
- **Measured** (`node tests/waysbots.mjs`, the real Player on the real terrain, 12 starting moments, 60 and 20 fps the same):

| Who | Storm Island | The Drip Tower |
| --- | --- | --- |
| right Way, naive (straight in / just climb) | 0 / 12 | 0 / 12 |
| right Way, skilled | 12 / 12 (about 6 s) | 12 / 12 (about 12 s) |
| Boomwing (wings, Sound) | 0 / 12 (blown back) | 0 / 12 (wings fold) |
| a walker | 0 / 12 (ink) | 0 / 12 |
| a Cling creature / a Fly creature in the other place | 0 / 12 | 0 / 12 |
| a Drake rider / the tower's ice from outside | 0 / 12 | 0 / 12 |

- Spec `ways` (`WAYS_ONLY=data|bots|real|fight|ipad|closed`): screenshots `tests/screenshots/ways-*.png`.

## 9. The lesson, and what it means for the Ways (proposal, waiting for the owner)

**Body = moving. Type = a power from what the creature is MADE OF, used on the world, never a better way of moving.** A type can never
mean "flies better", "swims deeper" or "climbs" if some creatures of other types have the body for it. Checking the table with that rule:

- **Fly** breaks it (wings belong to many types). Proposal: **Wind** (Sky, Drake: "its wings stir up storms", Scalewing's own words):
  call a gust where you look (a button), push a sail boat over the ink lake, spin a windmill that raises a bridge, blow fog away. A
  winged Boomwing flies, but it cannot make the wind blow.
- **Bubble** moves to **Dive**: it carries its own air (a bubble round its head), so it stays under water longest. **Alien** to **Power**
  or **Push** (a tractor beam that pulls things to you).
- **Dive** has the same trap (every swimmer swims): its power is the breath, not the swimming: only Dive types breathe under water;
  everyone else bobs up.
- **Cling** is fine: no other body climbs a wall; flying up one is stopped by the narrow shape (wings need room for every flier).
- The rest are already powers, not moves (dig, squeeze, slip through, glow, burn, power, dash, push, sneak, sense, charm, freeze).

## 8. Questions for you and your son

1. Does being Scalewing / Sproutle feel like *being* them? Behind or in its eyes: which does he pick, and where?
2. Storm Island and the Drip Tower: does he get what to do within a few seconds? Too hard, too easy?
3. The groups: anything he would move (Toxic in Burn away? Mind in Sense? Bug in Cling or Fly)?
4. Which Way next? (Dive and Dig would show the most different places.)
5. Should the creature you are be able to do anything to wild creatures (play, follow, help), or only move?


## 10. The design talk, 2026-11-12 / 13 (read this first; written for the next session)

The owner and Claude went back and forth over two days. Nothing below is decided except where it says **decided**. The owner ended
with: "I don't like this situation." The next session should pick it up from "The open question" at the end.

### What the son asked for
"Play as creatures even outside the battles. Like riding." In game terms: walk, fly, swim, climb AS your creature in the world.

### The two old problems (why it was dropped once, `plans/chapter3.md` section 2)
1. **Overlap**: abilities solve each other's places (a climbing challenge is also passed by any flier).
2. **Riding already gives bodies their movement** (fly / swim / run), so type-based abilities clash with what riding does.

### Attempt 1: the Ways (15 groups of types, each owning a kind of place). REJECTED in parts
- Each of the 46 wild types put in exactly one of 15 groups (Fly, Cling, Dive, Freeze, Dig, Squeeze, Slip through, Glow, Burn away,
  Power, Dash, Push, Sneak, Sense, Charm; table in section 4). Each group owns one "shape" of place (open stormy gap = Fly, narrow shaft
  = Cling, soft earth = Dig, crack = Squeeze, bars = Slip through...), places checked by a reach checker so no other group or MIX of
  groups gets in. Squad of three, both cameras, chapter 3 only.
- Claude's first version used **battle move kinds** (shot, rush, blast...) on world things. **Owner rejected**: "world movement or what
  happens with the creature in the world should reflect the type"; grouping types is fine.
- **Built as a test** (still in the game, ?preview, Bumpy Hills): Storm Island (Fly) and the Drip Tower (Cling). See section 7.

### The owner's first play of the test (2026-11-12): what broke
- The squad bar (Me + three creatures) was confusing, too much on a tablet. **Decided**: creature mode by itself in chapter 3's lands;
  "Be me" only in the pause screen; one **Swap** button (the Place slot; F on a keyboard). Built.
- Third-person camera flashed when walking W / A / D: a bug (the wall clamp read the head after copying it). Fixed and tested.
- Blazehound was slower as itself than when ridden. **Decided**: a creature moves exactly like riding it (riding.js RIDE numbers);
  riding in Wobbleland = creature mode. Built.
- The "swap only on the ground" rule: owner asked why; it was needless code. **Decided**: swap any time. Built.
- **"Too windy for Boomwing but not for bubbles? Make it make sense."** Only the Fly TYPES could fly the storm; Boomwing (Sound, huge
  wings) was blown back while a Bubble type was not. Changed: the storm is now the same for every creature with wings.

### Attempt 2: "body moves, type is a power". REJECTED
- Rule proposed: the BODY (wings / fins / legs) decides how a creature moves, the same for everyone; a TYPE gives a power from what
  it is made of (Wind gust, burn thorns, freeze rapids, power a lift, echo shows a path...), never a better way of moving. Fly would
  become Wind (Sky, Drake), Bubble would move to Dive (carries its own air), Alien gets a tractor beam.
- **Owner**: "can result in a pretty weak game". Claude agreed: "use a power on an object" is a key with a timer bolted on.
- **Owner on the storm**: "why do flyers enter that ink storm but not the riders? The criterion has nothing to do with flight, it's
  just timing." Agreed: Storm Island is a timing gate; wings are only the ticket. A real flying challenge must test FLYING itself.
- **Owner**: "most of the logic is breaking here with the riding, swimming and flying".

### The root cause (agreed)
Three different things decide what a creature can do, and they disagree:
- its **type** (Boomwing = Sound),
- its **looks** (37 species have `flies`, spread over 18 types: only 6 are Sky / Drake; 24 `floats` over 12 types; about 330 species
  in about 200 body shapes, including teacups, burgers, jukeboxes),
- **riding** (a random 1-in-4 `rideable` trait, plus a per-species land / water / sky ride list in traits.js).
Every rule built on one of them contradicts the other two.

### Attempt 3: a body tag per species (8 bodies). OWNER DOUBTED IT
- Proposal: one source of truth, a BODY per species chosen from its looks, used everywhere (creature mode AND riding): Flier, Swimmer,
  Climber, Hopper, Digger, Runner, Floater, Tiny; the body's movement IS the skill (flapping tires you, ride warm air; charge-and-aim
  hops; dig by rumble...). Types stay for battles (+ region effects like Ice grip, glowing light).
- Owner: "Wouldn't it be easier if Boomwing was part of Sky and not Sound?" Claude: not as a rule: moving every flier into Sky breaks
  7-per-type, gyms, the chart, saves, and themed types (Food, Time, Cozy) still need a body.
- **Owner**: "you aren't just proposing fly, swim, run. You're proposing 15 types (to match the location challenges). It won't be as
  easy for a child as you claim." **Claude agreed**: only fly / swim / walk (maybe climb) can be read from a creature's picture; a teacup
  or a raccoon can't tell a child if it is a hopper, digger or floater, so 8 bodies would need labels = a second category.

### Attempt 4 (the last proposal, NOT accepted yet)
- Only the bodies a child can SEE: walk/run, fly, swim (maybe climb with very visible sticky feet / vines). No labels.
- Variety from many different CHALLENGES per body (several flying skill games, several swimming, several on foot), each testing the
  movement itself, not a gate. The place says who it is for (deep water = swimmer, a sky spire = flier).
- Small per-creature flavour (speed, jump height, how long a flier lasts) that a kid notices but no place requires.
- Cost: less "only this creature can do this" magic.
- **Owner's reply: "I don't like this situation."** (Then asked to store everything.)

### Also floated and set aside
- Redesign all creatures (the owner's "big bet"): not discussed further. Claude's view: no redraws, but if a body list is used, a few
  models whose looks fight their body could get small touch-ups.
- Showing a body icon on cards / the Book: possible, but it is exactly the "second category" the owner fears.
- A review page with every creature's picture and a proposed body, for the owner and son to correct: offered, not made.
- Custom (the Wizard's guardian) choosing its way on the drawing board: an idea only.

### What is in the game now (all ?preview, Wobbleland only)
Creature mode (`src/being.js`, `src/creatureways.js`, `player.js` `clingStep`), Swap, both cameras, a creature moves like its ride,
fights entered as your creature, Storm Island (now a wings timing place, the owner calls it "just timing") and the Drip Tower (Cling).
Specs `ways` and `wobble` pass. Nothing of this is outside ?preview, so it can be changed or removed freely.

### Counted 2026-11-13: how many creatures would have to change type?
The owner asked: if types decided movement, and a type could give more than one (Drake = walk + fly), how many creatures would
have to move to another type so that it makes sense, in logic and in looks? Counted from all 322 wild species (their pictures,
descriptions, `flies` / `floats` and ride kind), sorted into the three bodies a child can see: **walks** (seals, otters, ducks,
turtles, penguins and crabs count as walkers: everyone paddles in this game), **air** (wings or floating) and **water only** (fish,
eels, jellyfish, sea serpents, boats).

The rule only means something if **every creature of a type gets all of its type's ways of moving**. (If a type only *allows* a
movement and the body decides, the type adds nothing: that is attempt 4.) So every creature has to look like its type's set. Giving
each type the set most of its creatures already have, the misfits are:

| Has to leave | Creatures |
| --- | --- |
| **Fliers / floaters in a walking type (36)** | saucerling, ufomax (Alien); runestone (Atlantis); smashbird (Ball); finnibone (Bone); wifly, wifly2, error404 (Cyber); voltwing, wattwink (Electric); flarehawk (Fire); hootiter, saturnowl (Gravity); glitterbop (Light); rivetron (Metal); peekaw, ravenshade (Ninja); chirpit, loudbeak (Normal); origrane, darto, jetfold (Paper); parroteer, featherbeard (Pirate); loopwyrm, peekhole (Portal); rainwing, auroraptor (Rainbow); echobat, **boomwing**, dinglet (Sound); twilorb (Time); dustbun (Tiny); ringlet, lustrelle (Treasure); gullop (Water) |
| **Walkers in a mostly-flying type (14)** | beetlet, hornbeetle, twirlshell (Bug); moonhop, lunaroo (Cosmic); scalekin, wyvlet (Drake; the babies); thinkit, visionelk, puzzlet (Mind); starbelle, pompet, pomperina (Pixie); pinwhirl (Sky) |
| **Water-only bodies in a land type, or walkers in Water (8)** | joltail (Electric); shimmerfin, spectrafin (Rainbow); bottlet, shipshape (Pirate); sushisail (Food); bubbuck, shellby (Water) |

**About 58 creatures (18 %), from 28 of the 46 types.** Only 18 types are already all one body: Bubble, Camo, Cozy, Doodle,
Dream, Funfair, Ghost, Grass, Ice, Knight, Mirror, Parkour, Racer, Rock, Slime, Squad, Surprise, Toxic. Being kind to borderline cases (babies "can't fly yet", dust bunnies, a sushi boat) only
brings it to about 50.

What moving them would cost:
- **7 per type breaks, but less than first written.** Any number of types may fly or swim (owner: "Bubble, Drake and several others
  can have fly"), so the count of 58 does not change (it is per type), but the moves partly fill each other's holes: the 7 flying
  types (Sky, Drake, Ghost, Pixie, Mind, Cosmic, Bug) give away 14 walkers and take 36 fliers, net about +22 (about 10 each); the
  walking types end about 22-25 short. Keeping 7 each means about 25 new walking creatures (or about 3 more types made flying ones).
  First written as "Sky would grow to 30+ and 58 new creatures": wrong, it assumed Sky was the only home for fliers.
- **It breaks the jokes the types are made of.** A paper plane is Paper, a parrot is Pirate, a Wi-Fi butterfly is Cyber, a bat that
  hears its squeaks is Sound, a wise owl is Mind. The themed types (most of ours) cross bodies on purpose; that is not a mistake to
  tidy up. Of the 58, very few would look *more* at home in Sky.
- Changing a caught creature's type changes its battles (the chart), gym and leader teams, the Book, the README tables, duels
  (`VERSION`), and the `roster` spec.

**Conclusion of the count:** "the type decides how you move" can't be made to fit our creatures by moving a handful. It needs about
58 moves plus about 25 new creatures, and it would still clash with every future themed type. Movement has to come from each
creature's own body (per species), and the types matter in the world some other way.

### A way to lower the count (idea, 2026-11-13, not decided)
A type's movement does not have to come from anatomy: it can come from a **prop the whole type visibly shares**. The Bubble type
already does this: wild Bubble creatures float inside their own bubble (`gait: 'float'`), so a duck or a hippo flying in a bubble makes
sense to a child. If a flying or swimming type has such a look (Bubble: its bubble; Ghost: fading; Sky: a string / balloon; Paper:
folds into a glider), its walkers stop being misfits, and the count drops type by type. It only works where the prop is drawn on every
creature of the type and reads at a glance; it can never explain a winged creature that is NOT allowed to fly (Boomwing in Sound),
so the 36 fliers in walking types stay the hard part.

### The owner's theory mapped out (2026-11-13, draft for discussion)
Each type gives a set of movements, any number of types can give the same one, and every creature of a type can do all of its
type's movements. The fewest changes that make all 322 creatures look right, using three tools before any move: a **type look**
(one thing drawn on the whole type that shows how it moves, like Bubble's own bubble), a **touch-up** of one model, and a **move**:
- Walks: 31 types. Walks + swims: Atlantis, Pirate, Water. Walks + flies: Alien, Bug, Cosmic, Drake, Gravity, Mind, Paper, Pixie,
  Rainbow. Flies: Ghost, Sky. Walks + swims + flies: Bubble.
- New type looks (25 creatures in 7 types): Alien a hover glow, Cosmic a stardust trail, Gravity orbiting little moons, Mind a
  lifting glow, Paper folds into a glider / pages flap, Pixie small fairy wings, Rainbow runs up its own rainbow. Atlantis' runes and
  Bubble's bubble already exist.
- Touch-ups (9): beetlet, hornbeetle (wing cases open), scalekin (small wings), glitterbop, dinglet (hop), twilorb, ringlet (roll),
  lustrelle (candle legs), pinwhirl (spins up like a propeller). Flightless birds, smashbird, wyvlet, sushisail, peekhole, dustbun fit
  by their own story.
- Moves (22): 11 to Sky (voltwing, flarehawk, peekaw, ravenshade, chirpit, loudbeak, parroteer, featherbeard, echobat, boomwing,
  gullop), 4 to Bug (wifly, wifly2, wattwink, rivetron), 2 to Ghost (finnibone, error404), 3 to Water (joltail, shimmerfin,
  spectrafin), loopwyrm to Drake, twirlshell to Slime.
- 7 per type: Sky 18, Bug 10, Ghost 9, Water 9, Drake 8, Slime 8; 11 types short by 20 in all (about 20 new walkers, or drop the rule).
- The page with the full map, the diagram and every creature: https://claude.ai/artifact/EdtF4Naq98N1fUHBLhstny (private to the owner).

### Plan B: redo the later creatures (owner 2026-11-13, draft)
Owner: the early creatures matter to them and their son, the later types (Cyber onward) less, so a later creature that does not fit
can simply become a new creature (new name and body, same saved id) instead of moving. Early = Normal ... Camo plus Rock (25 types),
later = Cyber, Cozy, Treasure, Food, Squad, Dream, Parkour, Ninja, Tiny, Pirate, Racer, Ball, Portal, Funfair, Surprise, Doodle,
Atlantis, Knight, Bubble, Gravity, Mirror (21). Early creatures keep name and body.
- 10 later creatures redone (ideas only): wifly / wifly2 (a walking Wi-Fi router, "Wiflow"), error404 (a glitchy pixel cat),
  peekaw / ravenshade (masked geckos), parroteer / featherbeard (pirate monkeys that repeat you), loopwyrm (a hoop snake),
  ringlet (rolls on its edge), lustrelle (walks on candle legs). Gravity keeps its owls (Saturnowl is the Boss) with its type look.
- Early creatures: 25 type looks (as before), 6 move a bit differently (animation only: beetlet, hornbeetle, glitterbop, pinwhirl,
  dinglet, twilorb), Scalekin already has small wings, 14 still change type (Sky +7, Water +3 -1, Bug +2 -1, Ghost +1, Slime +1).
- 7 per type: 5 types over, 7 short by 12 (Bone, Electric, Fire, Metal, Normal, Rainbow, Sound): 12 new creatures or drop the rule.
- Plan A (moves only) is now 22 moves (Scalekin fits). Both plans are on the same page with a switch.

### Plan B, revised: redesign vs move, not early vs late (owner 2026-11-13)
- Owner: sort by "redesign" vs "move". Chirpit and loudbeak become flightless birds and stay Normal (ideas: a turkey chick, a
  peacock); finnibone stays Bone with a walking body (a mudskipper-like bony fish); rivetron stays Metal (a tin beetle on treads).
- Now 14 redesigned (those four + wifly, wifly2, error404, peekaw, ravenshade, parroteer, featherbeard, loopwyrm, ringlet,
  lustrelle) and 10 moves left: twirlshell (Slime), voltwing, flarehawk, echobat, boomwing, gullop (Sky), wattwink (Bug), joltail,
  shimmerfin, spectrafin (Water). 7 per type: Sky +5, Water +2, Slime +1; Electric -3, Rainbow -2, Sound -2, Fire -1 (8 short).
- **The rule, made explicit** (the owner asked whether many-to-many is possible, given Rainbow's fish, birds and walkers): a type's
  set is "all of", never "one of". "Walks + flies" = every creature of that type does both; Rainbow flies only because every Rainbow
  creature gets the "runs up its own rainbow" look and the fish leave. Types to movements stay many to many (Drake walks and flies;
  flying is shared by Sky, Drake, Pixie...); what is impossible is a type whose creatures differ ("some swim, some fly"), because then
  the creature's body decides and the type says nothing (attempt 4). Walking is everyone's base, so in practice a type means
  "walks" or "walks + one extra" (Ghost and Sky only fly, Bubble walks, swims and flies).

### Decided 2026-11-13: how a child knows what a creature can do
- **A type may give two or more abilities; every creature of that type has all of them** (the all-of rule). Rejected: "one ability
  per type" and "every ability must be drawn on the body" (owner: "sticky pads? glow before entering a cave? come on"; and 8-10
  abilities = only 8-10 kinds of challenge).
- **The card says it:** tap a creature and its card shows its abilities as chips ([Climb] [Glow]). The same chips everywhere a
  creature is shown (team, Book, Swap). They come from the type, so learning one creature teaches its whole type.
- **The world says what it needs:** at a place, the button word appears if your creature can ("Climb!"); if not, the place shows the
  ability it needs and which of your creatures have it.
- **Looks only must not contradict:** no wings in a type without Fly, no fish in a type without Swim (that is what the redesigns and
  moves on the page fix). Other abilities need no drawing.
- Variety comes from places, not only from the number of abilities: places that need two abilities, several skill games per ability.

### Nobody changes type (owner 2026-11-13, the map's current state)
- Redesigned to stay in their type (ideas, to choose): twirlshell (stays Bug: a snail with little dragonfly wings), gullop (stays
  Water: a walrus pup), flarehawk (an emu with a flame plume), voltwing (a lightning-crested roadrunner), wattwink (a glow-worm),
  joltail (a land eel), shimmerfin / spectrafin (rainbow pangolins, never swimmers; spectrafin's ride water -> land).
- **Sound walks and flies** (owner: sound travels through the air): every Sound creature rides its own sound waves (rings of notes
  under it in the air). Boomwing (the son's favourite flier) and Echobat stay as they are; Drumbo, Bongorilla, Gongolin, Clawdio get
  the type look; Dinglet floats as before.
- Result: 22 redesigned, 29 with a type look in 8 types (Alien, Cosmic, Gravity, Mind, Paper, Pixie, Rainbow, Sound), 5 animations
  only, 0 moves, every type stays at 7. Plan A (moves) is dropped from the page.

### The 15 abilities, first draft (2026-11-13, for the owner and son to change)
Walking is everyone's, no tag. A type gives ALL its creatures its abilities (0-2 each in this draft). On the page as a clickable
type x ability grid. `?` = a weak fit.
- Fly: Bug, Ghost, Mind, Pixie, Drake, Rainbow, Cosmic, Sound, Alien, Sky, Paper, Bubble, Gravity (13)
- Swim (dive, hold breath): Water, Pirate, Atlantis, Bubble · Climb: Grass?, Bug, Slime, Parkour, Ninja, Gravity
- Dig: Bone, Treasure, Pirate, Rock · Squeeze (cracks): Slime, Paper, Food?, Tiny, Doodle · Pass through (bars, glass): Ghost, Dream,
  Portal, Mirror
- Glow: Fire, Electric, Rainbow, Cosmic, Light, Atlantis (Glowcap Caves' BRIGHT today: Fire, Light, Electric, Cosmic)
- Burn (thorns, tangles, ice walls): Fire, Toxic, Drake · Freeze (a path over wild water): Ice only · Zap (machines): Electric, Metal,
  Cyber
- Dash: Time?, Parkour, Racer · Push (boulders, cracked walls): Normal?, Metal, Squad, Knight, Rock · Hide: Camo, Ninja, Tiny
- Bounce (much higher than a jump): Cozy?, Ball, Funfair, Surprise · Lift (move things from afar): Mind, Pixie, Alien
- Weak spots: Freeze has one type; Normal could have none ("the plain type"); Time might want "slow time" instead of Dash.

- **Update (owner 2026-11-13): Charm and Sense are back** (they were dropped only for "can't be drawn", a rule the owner rejected;
  Power was renamed Zap). Charm (win over someone grumpy: a treat when it looks at you): Pixie, Cozy, Food, Funfair. Sense (an echo
  shows a hidden path, remember it): Mind, Sound. Cozy and Food lose their weak Bounce / Squeeze, Pixie gives Lift to Charm (Lift:
  Mind, Alien). Now 17 abilities; trimming back to 15 would drop Freeze (one type) and fold Lift in somewhere.

### The open question for the next session
How do creatures move and matter in the world so that (a) a child understands it at a glance, (b) it never contradicts what a
creature looks like or how riding works, (c) the challenges test the movement itself (not a timing gate or a key), and (d) it is a
strong, varied game, not "only three bodies"? Start by asking the owner what felt wrong about attempt 4, and what the son actually
enjoyed when playing as Scalewing / Sproutle / Boomwing. Don't build more Way places until this is settled.
