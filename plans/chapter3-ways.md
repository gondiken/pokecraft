# Chapter 3: being your creature, and the Ways (plan + the first test, 2026-11-12)

Your son's wish: **play as the creatures outside battles too, like riding.** The idea was dropped once (`plans/chapter3.md` section 2)
for two reasons:

1. **Overlap:** one creature's ability solves another's place (a climbing place is solved by any flier).
2. **Riding already gave bodies their movement** (fly, swim, run), so "why can't Boomwing fly when it has wings?"

This plan solves both. **The first test is built (?preview, Wobbleland only): see "Built" at the end.**

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
