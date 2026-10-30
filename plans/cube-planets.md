# 🌍 Gravity type and Cube Planets (built 2026-10-29, behind ?preview; see "Built" at the end)

Owner, 2026-10-28: picked from the "last three stars" ideas in `ROADMAP.md`; "I like both plans" (this one and
`plans/bubble-well.md`). **"For cube, for now cube is fine. I'll just have to play it to see if it'll work. Yes we
might need round in the end but let's see."** So: cube planets with straight (grid) gravity first, built so that round
gravity can be tried later without starting again (section 3.6). The Knight's Castle is being built in another session
at the same time; section 10 keeps out of its way. No task number on purpose (give it the next free `T` number when it
is built).

**Build this in a fresh session.** Read first: `CLAUDE.md`, `STORY.md` "The Picture Worlds", `plans/T40.md` (the Picture
World kit), `plans/T43.md` (a skill-game world: three games, never a fail, help after misses, harder rematch),
`plans/T41.md` (a world with its own movement: diving changed `player.js` only where `world.deepAt` says so; this plan
does the same with gravity), `src/player.js` (295 lines, the whole movement) and `src/comingsoon.js`.

**This is the expensive one** (about twice the Bubble world): the player, the camera, the guide arrow, the wild
creatures and the tests all have to understand "down is not always down". Build **step 0 first and let the owner play
it** before the games (section 9).

## The owner's rules this plan follows

- The way to the Boss is a fun, unique skill challenge: aim, dexterity, timing and direction, not puzzles. Never the
  same kind of challenge as another world. **Mind + skill together is fine when it fits the game's own play** (the
  Portal House): here it is finding your way when "down" changes.
- Skills already used elsewhere (see `plans/bubble-well.md` "The owner's rules"). **This world's three new skills:**
  finding your way on a surface that wraps round (orientation), guessing where a curved flight will land, and keeping
  the speed of a moving thing you jump off. **No hold-and-let-go and no power meter.**
- Never a fail (a fall is caught, a miss tries again), help after two misses, a harder rematch.
- iPad: joystick, Jump, one action button. **Kind to the stomach:** every camera turn is slow and smooth, never a snap,
  never upside down for long (section 3.4).
- **Ships closed:** only `?preview` and tests open it until the owner has played it (section 8).

## What the child does

Steps out of a picture frame into space: a dark-blue sky full of soft stars, and floating in it little planets that are
**cubes**, each with its own grass, flowers, a tree or two sticking out of every face. Walk to the edge of a cube and
keep going: you walk round the corner onto the side, and the sky turns with you. Jump hard toward the next cube and its
pull catches you and bends your flight. **Professor Orbit** waits on top of the biggest cube, the Great Cube, with a
ringed-planet turtle. To get there, the child does three things, each with one of the Professor's helpers:

1. **Comet Pup Chase**: tag a speedy comet dog that runs round the little planets. Chasing it never works: you must
   cut round a corner and meet it.
2. **Planet Hop**: jump from planet to planet, planets that pull your jump into a curve, some of them turning.
3. **Moon Ride**: ride a small moon round a planet and jump off at the right moment: you keep the moon's speed.

## 1. The look and the place

- Realm `gravity` (`pictureRealm`), a starry space sky (`look.still`, the Swirl's sky-dome code can draw it), no water,
  no fog wall but a soft dark blue far away.
- Planets are solid cubes of blocks, 9 to 21 blocks across, with a thin "skin" on **all six faces** (grass, a flower,
  a little tree or a rock pointing outward from each face), so every face is a little world. The inside can be hollow
  stone (cheaper meshes) except the top layers.
- Each little planet has a theme for its type's creatures: a meadow cube, a crystal cube, a moon-rock cube, a ringed
  cube (a flat ring of blocks round its middle you can walk on: a gravity puzzle in itself), the Great Cube (21 across).

## 2. Height: the 48-block limit

Every world is 48 blocks tall (`WORLD_H`, it also sizes the light buffer in `world.js`). Planets float in space, but
**up and down in the world data is only 48 blocks**. So the planets are **spread out flat**: a map about 224 x 224 with
the planets at y 8-40, never stacked. "Up" and "down" in space only exist near each planet anyway. A taller world for
realms (`WORLD_H` per world) would free the layout, but it touches the light buffer, every edit index and the save
format: **not part of this task.** Note it for the owner if the flat layout feels too flat.

## 3. Gravity on cubes (the core: build and test this first)

### 3.1 The rule

- Each planet is a box. **Down = toward the planet's middle, along the axis that is furthest out**: standing on the top
  face down is -y; on the east face it is -x; on the bottom face it is +y. So down is always one of **6 straight
  directions** along the block grid.
- Which planet: the one whose "field box" (its box grown by its own `reach`, 6-10 blocks) you are in; between two, the
  nearer surface. Outside every field: a soft pull to the nearest planet (so nobody floats away for ever) and after 6 s a
  catch puff back to the last face you stood on.
- Near an edge the "furthest out" axis changes, so **walking over an edge turns down by 90 degrees**. To stop flicker,
  the change needs the new axis to win by 0.4 blocks (a small hysteresis).

### 3.2 How the player uses it (no rewrite of `player.js`)

`Player.update` works in the usual frame (y up). For a world with `world.gravityAt(pos)` (null everywhere else, like
`world.deepAt` in T41), the player keeps a **frame**: one of the 24 ways to turn the grid (a 3 x 3 matrix of 0 and +-1).
`player.js` gets a thin **view** of the world (`frameWorld(world, frame, origin)`: `get(x, y, z)` and `isSolid`
translate local cell -> world cell) and its position and speed are stored **in the local frame**. Because the frame is
only ever a quarter turn, the player box stays a box on the grid and every collision rule (`collides`, `moveAxis`,
step-up, `floorBelow`) works unchanged. When down changes:

- the position and speed are turned into the new frame (exact: a whole-number matrix),
- the camera turns slowly to the new up (section 3.4) while the physics already uses the new one,
- `onGround` is cleared for one step so the player settles onto the new face.

Outside this world the player has no frame: `player.js` is bit for bit as before (the spec proves it, like T45's sketch
switch).

### 3.3 Flights between planets

A jump leaves one field and enters another. Inside a field, gravity is that planet's straight down, so a flight is a
**parabola that bends** when it crosses into the next field: it looks like a curve. Speeds: jump 8.6 as everywhere,
gravity per planet (`g` 0.6-1.0 of the main world's, so the hops feel floaty). The flight is a closed form per field
segment (`flightAt(p0, v0, fields, t)`), so 60 and 20 fps land in the same place.

### 3.4 The camera (kind to the stomach)

- The camera's "up" eases to the new up over **0.45 s** (a slerp of the frame), never a snap. Yaw and pitch stay the
  child's own, measured in the face's frame, so the stick always means "forward on this face".
- While flying between planets the camera up follows the field you are in, eased, never upside down: if a field's up
  points more than 120 degrees from the screen's up, the turn is spread over 0.8 s.
- Option for the owner after playing: **"steady camera"** in the pause screen (the world turns instead of the camera
  rolling; the horizon stays level). Build it only if the first try makes anyone dizzy.

### 3.5 Everything else that has to know about gravity

- **Guide arrow / nav:** the arrow points in the face's frame ("over the edge" when the target is on another face,
  "jump to the next planet" when it is on another planet; `cubeAim`).
- **Wild creatures:** they walk only on one face of their planet (their own frame, stored per creature), never over an
  edge (simpler, and nothing can fall off). Models are turned to the face.
- **People (crew, Boss):** stand on a face, turned with it (an `Npc` gets a frame; only in this world).
- **Other tools** (riding, building): **no riding** in this world (fly / ride assume y up); **no building**
  in the first version (placing a block on a sideways face is doable later, but the edit rules and `editAllowed` don't
  need to change for that, only the targeting ray, which is already 3D).
- **Play together:** a friend's avatar is drawn with their frame (their `state` message carries a frame number 0-23,
  only in this world; an old client ignores it).
- **Save:** `realmPos` carries the frame number as a 6th value (missing = upright).

### 3.6 Leaving the door open for round planets

The owner may want round planets later. Keep these seams so that change is a new `gravityAt` and a new player mode,
not a rewrite: `world.gravityAt(pos) -> { down: [x, y, z], field }` already returns a vector (on cubes it is always a
grid axis); the camera already eases between "ups" (a round planet just eases all the time); the games below only use
"which planet am I on", "where will I land" and "my speed", never the cube shape itself. Round planets would need a
non-grid player box (a capsule) against blocks: a separate plan.

## 4. The three games

### 4.1 Comet Pup Chase: finding your way on a wrapped surface

- **Comet Pup** (a crew member's pet, the Gravity type's little comet dog) runs round a planet's faces, always about
  one face ahead of you, leaving a sparkly trail. It runs a fixed loop of faces (closed form of the part's clock) and
  speeds up when you are close behind it.
- You tag it by touching it (or the big button within 2 blocks: **Tag!**). Running after it fails (same speed); the
  trick is to **see where its loop goes and cut round a different edge to meet it**.
- Three tags on three planets: a 9-block cube, a 13-block cube with a tree on every face (it hides behind them), and a
  long bar planet (7 x 7 x 21) where it runs round the long sides.
- Each tag is a `beaten` key `pw:gravity:tag1..3`. **Stargazer Stella** (crew) battles after the third.
- Help after two minutes on one planet: the pup's loop is shown as dots on the faces, and it runs x0.85.
- Pure rules (`orbits.js`): `pupAt(planet, loop, t)`, `pupSpeed(dist)`, the tag check; a stand-in robot that "chases"
  never tags the third, one that cuts to the meeting point does (the spec checks both).

### 4.2 Planet Hop: guess where a curved flight lands

- A chain of small planets toward the Great Cube. Some are still, some **turn slowly** round one axis (a closed form of
  the clock; see "Turning planets" below).
- No power meter: a plain jump, a sprint jump, and **launch flowers** (step on one: always the same push). Where you
  jump from and when decides where you land.
- Misses fall into the soft pull and are puffed back to the last face (never a fail). Rings of stars on the way: a cube
  each the first time.
- Done at the last planet: `beaten` key `pw:gravity:hop`. **Captain Comet** (crew) waits there.
- Help after two misses on the same hop: a dotted preview of the flight for 3 s after landing (where your next jump
  from here would go).
- **Turning planets:** a block planet cannot turn (the world grid is fixed). So a turning planet is drawn as a mesh and
  you stand on it like on a `Mover` (the toy train, the bottle cap): `carry` with the planet's closed-form turn, gravity
  toward its middle along its own turning axes. Keep this to one or two planets; if the frame code (3.2) can't do a
  non-grid frame, make those planets swing back and forth by quarter turns at fixed times instead (still a timing
  skill, and grid-only).

### 4.3 Moon Ride: keep the speed of what you jump off

- A small moon (a 5-block cube) **circles** a middle planet on a closed-form orbit (an ellipse at about 4 blocks a
  second, slower near one end). You step on at its slow end (it pauses there for 2 s).
- Jumping off **keeps the moon's speed** (added to the jump): that is the new skill (nothing else in the game does it:
  cannons, ropes, the coaster and the train all put you down or set your speed).
- Targets: three **landing rings** on other planets, each reachable from one part of the orbit only. Jump too early and
  you go wide, too late and you fall short. A ring counts when you land inside it: `beaten` keys
  `pw:gravity:ring1..3`. **Moon Mechanic Milo** (crew) waits by the third.
- Help after two misses: the moon slows (x0.8) and the ring glows brighter while you are at the right part of the
  orbit.
- Pure rules: `moonAt(t)`, `jumpOff(moonVel, jump)` -> the flight (3.3), `ringHit`; robots: a jumper at the right
  phase lands, one at a random phase mostly misses (the spec checks a 70%+ / 20%- split).

## 5. Professor Orbit (the Boss)

- A person Boss (`look: 'orbit'`: round glasses and a ringed-planet hat) with his giant **Ringshell** (the ringed-planet
  turtle), top level 63, on the **top face of the Great Cube** (21 across).
- **Gate:** the five keys (tags, hop, rings) and the three crew (`crewLeft`).
- **The finale (short, no timer):** the Great Cube has no way up its sides except round the edges: from the last
  landing ring you walk over two edges (the camera turning) to its top, with a moon jump in the middle (a small moon
  circling the Great Cube itself). All three skills once.
- Won: the star and the Wizard's note; the keys clear (`battleEnded`), a rematch is harder (`hard`: the pup x1.15, the
  moon x1.15, planets turn faster).
- Lost: stay at the Great Cube's rest, healed.

## 6. The Gravity type

- Type id `gravity` (Cosmic already has stars and space; this type is about **pull and orbits**).
- Creatures (7, own shapes):
  - **Cometpup > Cometcanine** (a dog with a comet tail; the big one leaves a trail): shape `cometdog`. Rideable? Land.
  - **Ringling > Ringshell** (a turtle whose shell is a planet with a ring): shape `ringturtle`.
  - **Satlet > Satellark** (a little satellite bird with panel wings): shape `satbird`.
  - **Moonmole** (7th, single stage): digs into one face and pops out of the opposite one. Shape `moonmole`.
  - Every model has `gear: 'orbit'`: one or two tiny moons circling it (one merged mesh, closed-form spin).
- **The wild look:** wild Gravity creatures circle slowly round a spot on their face (`gait: 'orbit'`, closed form);
  walk into their circle or tap to battle. Rare (`wild: { max, every }`), the big forms after the first game
  (`AFTER_CHECKS.gravity`).
- Moves: Pull In, Orbit Spin, Comet Dash, Heavy Step (lower speed), sigs Comet Tail (Cometcanine) / Ring Toss
  (Ringshell), big moves. Own fx entries, `fx:gravity` sound. Chart: own row + separate lines (suggested: hits sky,
  racer, parkour; weak to portal, alien, mind; resists rock).
- `look: 'orbit'` for the crew and Professor.

## 7. Blocks: very few new ids

Same budget as `plans/bubble-well.md` section 7 (ids stop at 255; the Castle took 254 and 182). This world's ids are
fixed there: **149** = the gravity wool (`WOOL_ID_OVERRIDE`), **183** = `PLANET_ROCK`, **249** = `STAR_GRASS`; nothing
else (every face's skin is existing grass, flowers, stone, crystal and leaves). Never take Bubble's 255 / 147 / 148, the
Custom type's 137 or the spare 138-139.

## 8. Shipping closed (the preview switch)

Add `'gravity'` to the Castle's `LATER` list in `src/comingsoon.js` (it already exists: `worldOpen` says no without
`?preview` or the test flag, and the frame keeps its secret look; see `plans/bubble-well.md` section 8, do not add
`PREVIEW_ONLY`). Closed: the frame stays covered, the
guide never points into it. Opening it later = removing `'gravity'` from that list.

## 9. Build order (stop after step 0 for the owner to play)

0. **The gravity sandbox** (behind `?preview`): the realm with three plain cube planets, the gravity rule, the player
   frame, the camera, walking over edges and hopping between planets. No games, no type. **The owner plays it** and
   decides: keep cubes, tune the camera, or think about round planets.
1. The world (all planets, looks, ways back, keeps, nooks), the guide.
2. The three games, the crew, the Boss and the finale.
3. The Gravity type, wild creatures, the Book.
4. Play together, iPad, screenshots.

## 10. Staying out of the Knight session's way

- **Picture World slot:** Castle `secret3` (built, T49), Bubble `secret4`, **Cube Planets `secret5`** (rename its id to
  `gravity`; no save can hold a secret world's star). That uses the last covered frame.
- **Block ids:** section 7.
- Shared files: append in their own sections only, never re-order old lines; merge `main` before starting and before
  pushing. `player.js` gets only the frame branch (a world with `gravityAt`); nothing in the old path moves.

## 11. Files

| File | What |
| --- | --- |
| `src/gravity.js` | pure: `FRAMES` (the 24 quarter-turn frames), `frameOf(down)`, `toLocal` / `toWorld`, `downAt(planets, pos, prev)` (with the hysteresis), `fieldOf`, `flightAt`, `frameWorld(world, frame)` |
| `src/orbits.js` | pure: the games' rules (`pupAt`, `moonAt`, `jumpOff`, `ringHit`, launch flowers, turning planets), `gravityHelp(misses)`, `HARD` |
| `src/cubeland.js` | terrain as data (Node-runnable): `PLANETS` (centre, size, theme, `reach`, `g`), `cubeLand(world, def)`, `cubeAim` |
| `src/cubelive.js` | `CubeLive` = `LIVE.gravity`: the pup, the moon, turning planets, rings, chip, `near` / `use` (Tag!), `battleEnded`, `manual` + `step(dt)`, `info()` |
| `src/player.js` | the frame branch only (3.2) |
| `src/main.js` | the camera's eased up (3.4) and the `realmPos` frame number, marked lines only |
| `tests/cube.mjs` + `tests/cubecheck.mjs` | the spec and the terrain check (walk graph over faces and edges, hop edges from `flightAt`) |

## 12. Tests (spec `cube`)

- **off:** the main world, the Dream and the Swirl move the player bit for bit as before (a recorded walk compared).
- **gravity:** every one of the 24 frames turns and turns back exactly; walking round every edge of a cube with the
  real Player at 60 and 20 steps a second ends on the same cell; no flicker on an edge; stepping off a corner; a jump
  that crosses two fields lands where `flightAt` said; the catch puff; nobody stuck on any face of any planet.
- **land:** three seeds, the walk graph reaches every planet only with the hops it is meant to need.
- **games:** the robots in section 4 (chase vs cut, phase vs random) at 60 and 20 steps; help after misses.
- **play:** the whole loop in the browser, a reload keeps the frame and the keys, the Boss, the star, a rematch.
- **closed**, **ipad** (the stick always means forward on the face; the camera turn over an edge), **pair** (a friend's
  avatar on another face is drawn sideways and right).
- Screenshots `cube-*.png` (one on a side face, one mid-hop) for the owner.

## 13. Open questions for the owner

- After the sandbox (step 0): is the turning camera fun or dizzying? Do you want the "steady camera" option?
- Names: "Little Cubes", "Professor Orbit", "Comet Pup" are working names.
- Should the Moon Ride be the finale instead of the Planet Hop (it is the newest skill)?

## Built (2026-10-29, steps 0-4; behind `?preview` until the owner plays it)

Owner's feedback on step 0 first: the eased camera turn stays; the **steady camera was removed** ("just a blink"); no round planets,
no bevelled edges; riding stays off (`noRide`). Then "build the rest of gravity", with the rule **"easy to understand, hard to master"**.

**The world** (`cubeland.js`, realm version 2: step 0's planets moved; nothing can be built there, so no edit is lost and a step-0 spot
arrives at the start). 11 box planets spread flat in 224 x 224: the Meadow Cube (hub, way back), east the Crystal Cube, Tree Cube and Long
Rock (21 x 7 x 7) for the chase, west the Moon Base (23 x 5 x 23, a flat planet the moon circles over), north the Flower Cube and four
pebbles (light: g 0.45) for the Planet Hop, far north the Great Cube (21) with Professor Orbit and a second way back. Hub planets are joined
by plain jumps face to face across 4 (`HOPS`, proven both ways); the pebbles and the Great Cube are reached only by the flowers
(`cubecheck.mjs` builds the plain-jump graph from every face and checks it).

**The games** (`orbits.js` pure, `cubelive.js`; bots `tests/cubebots.mjs` with the real Player and the real CubeLive in Node, 60 and 20 fps):
- **Orbikit Chase** (the plan's Comet Pup): a little comet cheetah runs a fixed loop of faces (a belt, a slanted hexagon round all six
  faces of the Tree Cube, the long belt of the Long Rock), its whole loop dotted faintly, a bright trail behind it. Behind you it sprints
  (7 b/s, faster than your 6.2); in front of you on its own face it sees you (6.5, trees hide you) and turns; it also hears you within 2.2.
  Only round a corner does it run into you. Bots: chasing 0/6, camping on its loop 0/6, wandering ≤ 1/6 in 45 s, waiting round a corner 6/6.
- **Planet Hop**: launch flowers are gravity-wool pads; **Jump on one** (a decision: not on stepping) pushes you 12 along up
  (`world.launchAt` in player.js's frame step). How you run onto it (stand / walk / run) and which way decides where the pulls bend the
  flight. A flight that lands anywhere but the next pebble is a miss: a puff takes you back. Hop 1 teaches (walk or run), hop 2 needs a
  WALK (running overshoots and the Sky Pebble catches you), hop 3 flies up to land upside down under the Sky Pebble, hop 4 launches from
  that underside and needs a RUN. Bots: the right runs 4/4; running straight at the next pebble fails hop 2, walking straight at it fails
  hop 4; random runs land 3-17 of 24 per hop, the whole chain by luck < 0.5 %.
- **Moon Ride**: the moon (a mesh, a `carry`) circles the Moon Base on an ellipse, slow by its stop (it waits 2.5 s), fast across; Hop on!
  at the stop, Jump keeps the moon's speed (`jumpOff`); land in the gold ring (one at a time: under the slow part, the fast part, the far
  turn). Only a landing straight from a moon jump counts (walking into the ring does nothing). Bots: the right moment 100 %, jumping right
  over the ring 0 %, a random moment ~6 %.
- Never a fail; kind help only `gravityHelp` (= kindHelp; listed in kindhelp.js); `HARD` (rematch) x1.15; just for fun after all won;
  a won Boss battle clears the seven keys.

**Departures from the plan** (and why): the pup is the type's Orbikit (a comet cheetah), not a dog (too many dogs, and Comethorn is
already a comet); the turtle Ringshell became the owl **Saturnowl** (turtles exist twice; Ringling was too close to Ringlet), Satlet and
Moonmole were replaced by **Danglet > Turvysloth** (a sloth hanging from its own tiny planet: down is wherever its claws are) and
**Wallibex** (Magmole is a mole; a satellite bird would be the second bird). **No turning planets** (not robust with grid frames; the plan
allowed dropping them); the hop's variety comes from run-up speed, direction and the upside-down launch. Moon rings are on the Moon Base
itself (a side-face ring was tried: landings on an edge are too fiddly), not on other planets. The finale is the last hop onto the Great
Cube's side and walking round its edge to the top (no extra moon there). Keys are 7 (3 tags + hop + 3 rings), not 5. Wild Gravity creatures
circle on TOP faces only (so battles stay upright; the plan said "one face"). People stand on top faces. `GRAV.soft` 0.15 -> 0.3 and a
planet `pad` (the hop's kind help) in `downAt`.

## Redesign 2026-10-29 (natural rules)

The owner played the built world: the Moon Ride was "the perfect example of the problem" (a moon that stops in one place, rings to jump
into: hard to understand, then far too easy), the chase's ramp was wrong (rounds 1-2 very easy, round 3 very hard), the Planet Hop was fun
but "the flower rule (why?)" and "were the gravities different?" were confusing, more lore was wanted, the "steady cam" he asked for was a
third-person camera, and there was too much instruction text. The binding principle: every rule is natural space / gravity physics a
child expects, visible in the world, with a reason in the story, needing no rule text.

- **Gravity:** yes, it was different (hub planets 0.7, the Moon Base 0.6, the pebbles 0.45, nothing showed why). Now every planet pulls
  the same, `GRAV.g` 0.5 (floatier: a plain jump goes 2.64 high for 1.2 s instead of 1.89 / 0.88 s), the hub planets are 6 apart instead
  of 4, and in the air the stick only nudges you (`GRAV.air` 1.5, was 10): in space you keep your speed, so flights are readable. We chose
  "the same everywhere" over "bigger pulls harder" because the hops stayed predictable and the bots tested cleanly with one number.
- **Lore** (STORY.md): Professor Orbit's little-planet observatory; his pet Orbikits got loose; spring flowers grow on his pebbles; his
  telescope's three lenses fell onto far Lens Rocks that only the moon ferry passes. Told by the helpers' lines and the gate, not by chips.
- **Spring flowers:** a big bloom on a fat green coil (`buildSpring`) that squashes under you with a creak and boings when you jump.
  The hop chain was re-placed for the one gravity (hop 1 walk only, hop 2 straight up onto the Sky Pebble's underside, hop 3 sprint only).
- **The Moon Ferry** replaced the Moon Ride: a little moon goes round a little sun on a real (Kepler) orbit over the Moon Dock and out
  into space, slow at its far end, fast round the sun, never stopping; it scoops you up as it passes. Three Lens Rocks float out there,
  too far to jump to (proven in `cubecheck.mjs`); jump off and you keep the moon's speed, so you let go early, like a sling. The moments
  that work get shorter rock by rock (0.93 / 0.74 / 0.45 s); jumping when the rock is closest never works; random moments ~8 %.
- **The chase ramp:** each round has its own numbers in `PUPS` (round 1 slower with a bigger touch, round 3's Orbikit is playful and
  turns back by itself every 7 s, never toward you when you are close). Measured with `playChaseKid` (a child bot that sees only what is
  in view, thinks every 0.5 s, presses Tag! late, stands off the perfect spot): medians about 17 / 32 / 41 s.
- **Steady camera** (`cubecam.js`): optional third person behind your own blocky avatar; over an edge the avatar turns at once while the
  camera holds 0.2 s and swings round the edge in 1.4 s (no snap, no roll). V, the pause button, the Ride slot ("Camera") on tablets;
  remembered per device. Default stays the first-person eased turn.
- **Less text:** the guide names only where (an emoji, a name, an arrow); toasts only say what happened.
- **Saves:** realm version 3 (an older spot arrives at the start); the owner asked for his progress to be reset, so a save without
  `pw:gravity:redesign1` loses its Cube Planets keys, crew, star and Boss wins once (worldreset.js, shared with the Bubble Well; fine only
  because the world was preview-only). ?preview's "Start this world over" works here too (it keeps the mark).

## Owner's notes after playing the redesign (2026-10-30)

- **Steady camera** ("still follows the person quite closely ... a wider shot ... even less dizzying"): `cubecam.js` is now a wide shot
  (9 blocks back, high, your planet and the next one in view) whose yaw follows yours lazily (`yawRate` 0.8/s, at most `yawMax` 1.2 rad/s:
  a quick look round barely moves it; turning right round brings it round in a couple of seconds); pitch only tilts it a little. Edges as
  before (hold 0.2 s, ease 1.6 s, no roll). Default stays first person.
- **Looks:** the moon ferry is now Professor Orbit's little flying saucer (`buildSaucer`; the Saucer Dock, Saucer Mechanic Milo; the orbit
  and every rule unchanged); the lenses are telescope pieces drawn like 🔭 (a blue tube with gold rings and a glowing lens, tilted up), and
  each one found comes back on his big telescope beside him on the Great Cube; spring flowers have a bigger coil, bounce by themselves,
  squash wide under you and stretch tall on the boing.
- **Ways back:** the blue "home flowers" became little swirl doors in the Meadow Cube's green and gold (`BACK_SWIRLS`); the words say
  "Back to the Meadow Cube", never "home".
- **Planet Hop colours:** the four pebbles are coloured wool (Orange, Blue, Yellow, Green Pebble), each flower's bloom has the colour of the
  pebble it sends you to, and the next pebble glows (a pulsing shell and a beam, `buildBeacon`); the guide no longer shows colour emojis
  (on the flower its arrow points at the glowing pebble).
- **Orbikit Chase: a bug-like rule, found with real play.** The old rule turned the Orbikit the very instant it came over the edge and saw
  you, unless it was already touching you: standing within about 1 block of the edge won, 1.5 blocks back it saw you and turned while
  nearly touching you (and Tag! was on screen but came too late); it also "heard" you from any side within 2.2. So the same move (waiting
  round a corner) won or lost by half a block, which felt random. Now: whenever it sees you a "!" pops up over it. Seen from afar (more than
  `surprise` ahead, or off its way) it turns and runs. Seen up close on its way (it came round the corner right at you) it cannot stop and
  skids into you: tagged, with a burst of sparkles. No hearing; running after it only makes it sprint. Tag! is offered exactly when a press
  tags. `playCorner` (tests/cubebots.mjs) proves it round two corners of each planet at 60 and 20 fps; the ramp is kept by `surprise`
  3 / 2.8 / 2.2 per round.

## Owner's notes after that round (2026-10-30): hearing you can see, two more Orbikit rounds

Owner: "We can keep the Orbikit hearing us if that was a rule before. I didn't know it was (which is problematic, it should be obvious
somehow, without yet another instruction text), but otherwise it's actually a good idea when the topic is sneaking in 3D space. Maybe we keep
these current Orbikit ones but add two more (planets and Orbikit challenges) where the trail of the Orbikit is more complex, so we have to
calculate properly. That will be the difficulty change (not somehow better perception from the Orbikit in those two new challenges)."

- **Hearing, shown by the world, no text.** Running is noisy, walking and standing are quiet, as in real sneaking. On a chase planet each
  running step (on the ground faster than a walk: Shift, or the stick pushed all the way; a light push of the stick walks) leaves a ring on
  the ground (`buildRipples`, a soft pat `orbistep`) that grows to exactly as far as that round's Orbikit hears (`hear` 3.5 / 4 / 4.5 / 4.5 /
  4.5, feet to feet). If a ring reaches it, its ears go up: a blue "?" (not the orange "!" of seeing), a startled little hop round to look at
  you (`orbiheard`), and it bolts the way round its loop that gets it furthest from you (`awayFrom`), listening again while it flees, so
  running after it never works, not even across a figure-eight. It counts as a miss like being seen (the kind help). Walking up to the
  corner just as it comes tags it every time; running up to it, it always hears you (`playCorner({ approach })`, every corner of every round).
- **Two more rounds** past the Long Rock, reached by plain jumps: the **Twister Rock** (11 x 11 x 25: two corkscrews round it, winding opposite
  ways, crossing in an X on two sides; each corkscrew is straight when you unfold the rock, so no chaser can cut it) and the **Twirl Cube**
  (14 across: two belts round it that cross on top and underneath; on top it always switches belts, underneath it runs straight on). Both
  Orbikits have round 3's numbers exactly (`base`, `boost`, `see`, `tagR`, `surprise`, `flip`, `hear`). What makes them harder is the way:
  it crosses itself, so another strand can see a hiding spot, and a child must follow the dots past a crossing to know which corner comes
  next. The faint dots show the whole way (never more than 0.4 blocks from a dot). Keys `pw:gravity:tag4` / `tag5`; the gate and the chip
  need five tags (`TAGS`, `gravityState().tagNeed`), nine keys in all; an old save with tag1..3 keeps them and plays the two new rounds.
  A first try at a zigzag way was dropped (a chaser cut across the zigzags), and so was a tighter corkscrew (too many hiding corners: easy).
- **The child bot** (`playChaseKid`) now lands where a plain jump from the planet before puts it, looks round for a moment first (up to one
  lap: the seeds start at different moments), walks when it guesses the Orbikit is close and may follow the wrong strand where a way crosses
  itself (`crossingsOf`, 0.3 a crossing). Medians (30 seeds, err 1.0) at 60 fps: 10 / 14 / 17 / 22 / 40 s, at 20 fps: 12 / 11 / 22 / 23 /
  45 s (round 5 under 4x round 1); the spec's 12 seeds: about 12 / 13 / 16 / 24 / 30 s. `chaser`, `camper`, `noisy` never tag; `skilled`
  (reads the way with `hiddenOnTheWay`, walks when close) always.
