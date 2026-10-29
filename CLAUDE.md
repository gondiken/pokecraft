# PokeCraft: notes for Claude

A browser game (Minecraft-style voxel world + collectible creatures, gyms and badges) built for the
owner's son. Player-facing docs (features, controls, gym list, type chart) are in `README.md`;
this file is for working on the code.

## The people and their preferences

- The owner (parent) plays with their son, on desktop and **iPad/tablets**. Keep text short,
  friendly and readable by a child; error messages should say what to do next.
- **No Pokémon names or exact Pokémon terms.** All creatures, moves and gym names are original.
  Types that came from Pokémon were renamed: Poison → **Toxic**, Fairy → **Pixie**,
  Dragon → **Drake** (Psychic is **Mind**, Steel is **Metal**, and **Rainbow**, **Bone** and **Alien** are our own; 44 types in all (T49 added **Knight**, the Castle's type, wave 16 **Bubble**): **Sky**, **Slime**, **Light**, **Paper**, **Time**, **Camo**, **Cyber**, **Cozy**, **Treasure**, **Food**, **Squad**, **Dream**, **Parkour**, **Ninja**, **Tiny**, **Pirate**, **Racer**, **Ball**, **Portal**, **Funfair**, **Surprise**, **Doodle** and **Atlantis** are our own too; Tiny to Ball came with wave 14, Portal to Atlantis with wave 15).
- Gym difficulty should stay on the easy side; the owner already asked once for easier gyms.
- **The way to a Picture World Boss must be a fun, unique skill challenge** (owner 2026-10-27): aim, dexterity, timing and
  directional tactics beat puzzles. The rowboat sinking was the best so far; the latest football and basketball were good;
  the race was a good idea but stayed too simple and easy; the Giant House puzzles worked because the place is so unique.
  Never repeat the same kind of challenge in another world. Mind + skill together is fine when it fits the game's own play
  (e.g. the Portal House in the spirit of Valve's Portal). A Surprise world may use plenty of randomness.
- **"Easy to understand, hard to master. Never forget this rule!"** (owner 2026-10-29). A child must get what to do in a few
  seconds (one clear look + at most one short line), and the obvious shortcut must never beat it: e.g. jumping and building
  (or blowing a bubble) under yourself like a pillar is the chapter-1 sky-gym trick and must never solve a Picture World
  challenge. Test every game with real keys through the game's own loop, with a "naive kid" bot that must fail and a skilled
  one that must win.
- **No Google sign-in.** It was tried and removed (needs Google Cloud console setup the owner
  didn't want). Email + password and "Forgot password?" are the sign-in options.
- Prefer free services. Deployed on GitHub Pages; backend is a free Supabase project.
- **The game's story** is in `STORY.md` (the Wizard, why creatures battle, cubes, gyms, the Tower, the Swirl, its Picture Worlds and stars, the Scribble).
  New features should fit it.

## Running and deploying

- No build step: plain ES modules in `src/`, served as static files (`python3 -m http.server`).
  CDN libraries are pinned in the import map in `index.html` (three@0.160.0 from unpkg,
  @supabase/supabase-js@2.117.2 from jsdelivr).
- **Branches:** `main` is the real branch. `claude/clever-ritchie-etj0nq` was the first working
  branch and is kept identical to `main`. **The owner wants them kept in sync:** after finishing
  work on any `claude/...` session branch, also push the same commit to `main`
  (`git push origin HEAD:main`), and to `claude/clever-ritchie-etj0nq` while it still exists.
  Only fast-forward; never force-push `main`.
- **Live site:** GitHub Pages at https://gondiken.github.io/pokecraft/ (root folder). It updates
  ~1–2 minutes after a push to `main` (Pages is set to `main`; `claude/clever-ritchie-etj0nq` is
  kept identical).

## Code map

Most game files are listed here; "Key ideas" below holds the rules. Files marked Node-runnable (pure, or need only a stand-in
world with `W/D/data/ground/index/inBounds/get`) are run in Node by their specs.

| File | What it does |
| --- | --- |
| `src/main.js` | Glue: renderer, input, game loop, save/load, title + pause screens |
| `src/accounts.js` | `createAccounts(game, deps)`: sign-in box on the title screen, online save upload/download (T15) |
| `src/playtogether.js` | `createPlayTogether(game, deps)`: share/join box, visitor `loadWorld`, `goHome`, wires `Multiplayer` and `Duels` (T15) |
| `src/rematch.js` | T28 gym rematches: `rematchTeam(def, wins)` (pure), `loadWins`, `rematchMoves` (T25 hook), `REMATCH`, `createRematch` -> `game.rematch` |
| `src/hideseek.js` | T30 hide and seek: `HS`, `createHideSeek(game)` -> `game.hideSeek` |
| `src/guide.js` | `createGuide(game)`: guide arrow and welcome / closed toasts; knows no gym kinds, only reads `game.access.of(gym)` (T15, T16) |
| `src/destinations.js` | T39a "Where to go": `Destination` classes (gym, spot, realm way, words, friend), `DESTINATIONS` (`addDestination`/`removeDestination`), `createNav(game)` -> `game.nav` |
| `src/navui.js` | T39a `createNavUi(game)` -> `game.navUi`: the `#nav` panel (G, or tap the guide line): picks a Destination, nothing else |
| `src/access.js` | Gym access objects (T16): `WHERE` (surface / cave / sky...) x `WHEN` (always / night...) pieces, `createAccess` -> `game.access.of(gym)` (`aim`, `tips`, `contains`, `welcome`, `wait`, `closedText`). New gym kind = a `WHERE`/`WHEN` entry (+ `def.access`), never an `if` in the guide |
| `src/realms.js` | T31 realms: `REALMS` (`dream`, `swirl`, the Picture Worlds via `pictureRealm`), `TERRAIN_AIMS`, `TERRAIN_RETURNS`, `realmSeed`, `isNight`, `nightProgress`, `REALM_BUILDERS`, `generateRealm`, `routeOf`, `cleanRealmEdits`, `convertRealmEdits`, `createRealms` -> `game.realms` (`useBed`, `enter`, `leave`, `restore`, `update`, `route`, `aim`, `versions`, `mainPart`, `edits`, `follow`, `stash`...) |
| `src/portal.js` | T38a `PORTAL_AT`, `buildPortalDoor(world, tower)` (sets `world.portal`), `createPortal(game)` -> `game.portal`: the main door (`setLive`), travel, ways back (`world.doors`, `BACK_IDS`), the Swirl's frames, star stones, lift streams; `DoorGlow` (owner 2026-10-25: a magical door; shader vortex, 3 draw calls; optional 4th arg `{ normal, centre, w, h, lite, colours }`, `tint`) |
| `src/swirlsky.js` | T38d `createSwirlSky` -> `game.swirlSky`: the Swirl's sky dome, zone fog / brightness, puffs, sparks, frames, wheels; feeds `swirlTint` |
| `src/swirlland.js` | T38a/d Swirl terrain (TERRAINS.swirlLand, Node-runnable): decks, stairs, `LIFTS`, frames, bridge, Wizard's island (`stoneX`, `wizardX(n)`), `ZONES` / `zoneAt` / `zoneMix`, decor data; sets `world.door`, `keeps`, `lifts`, `world.swirl`; `swirlAim` |
| `src/pictureworlds.js` | `PICTURE_WORLDS` (12 stars, append-only ids; `portal` has `door: false`; `secret*` placeholders; owner 2026-10-26: the Wizard gives no star), `FRAME_WORLDS` (11), `BRIDGE_WORLDS` (12), `pictureWorld(id)`, `fullName(w)` ('Playland · Race Track'), `loadStars` |
| `src/comingsoon.js` | `OPEN_NOW`, `LATER`, `worldOpen(id)`: which Picture Worlds are open outside `?preview` |
| `src/picturelands.js` | T40 shared Picture World terrain kit (Node-runnable): `flatLand`, `buildWayBack` (`world.doors`, `world.arrivals[id]`, `world.rests`, a keep), `placeBoss` (BOSS_STAND, `world.bosses`), `placeCrew`, `pictureAim`, stand-ins `STUBS` / `pictureStub` |
| `src/playland.js` | T40 Playland: one 224 x 224 world for Race Track, Ball Stadium, Funfair: `HUB`, `ZONES`, `PLAYLAND_PARTS = { race, stadium, fair }` (each writes only inside its zone box; no part = a "Coming soon" sign), `playlandSpawns`, `zoneAt`, `playLand`; `world.realmBiome` = the zone |
| `src/pictureboss.js` | T40 Bosses: `BOSS`, `addBoss(def)` / `bossOf` (person or `model: { species, scale }`, `team`, optional `gate(game)` / `crew`), `bossTeam(def, wins)` (cap `REMATCH_CAP`), `loadBossWins`, `crewKey`, `crewLeft` / `crewText`, `createBosses` -> `game.bosses` |
| `src/mover.js` | T40 `Mover` (a ride carrying the player: `Player.carry`, `canLeave: false` ignores Space) and closed-form `PATHS` (open registry) |
| `src/forfun.js` | Owner 2026-10-28, pure: `ForFun` (rounds again in turn once all are won) and `FUN.tag`: every won skill game stays playable just for fun |
| `src/kindhelp.js` | Owner 2026-10-28, pure: the ONE kind help of every Picture World skill game: `KIND_HELP = { after: 2, step: 0.02, max: 0.10 }`, `KindHelp`, `KIND`, `kindHelp(misses)` -> `{ misses, ease, on, slow, more }`; each game's levers are listed in the file's comment |
| `src/giantland.js` | T40a Giant House terrain as data (Node-runnable, 192 x 192): counter, sink, tap, groove, shelf, fan, table, cookie, fort, seesaw, cat, track, mouse hole, keyhole, crumbs, nooks; `houseLand` (TERRAINS.houseLand), `houseAim` (one puzzle step at a time) |
| `src/houselive.js` | T40a `HouseLive` = `LIVE.house`: the four puzzles (towel + wind-up key / fan, plug + tap / river, yarn + cat, marble + spoon fling), the train, the bottle cap, crumbs (`pw:house:crumb<i>`, `crumbKey`); puzzle words via `near` / `use` |
| `src/houseprops.js` | T40a.5 the Giant House's puzzle things as THREE models (owner 2026-10-26: blocks did not say what a thing is): cat, yarn, seesaw, marble, ruler, plug, key, towel, crayon `NOTES`; `tests/houseprops-preview.mjs` photographs them |
| `src/pirateland.js` | T40b Pirate Seas terrain (TERRAINS.pirateLand, Node-runnable): `ISLES`, `CANNONS`, `ROPES`, `WALKS`, `ROWBOATS`, `AIM`, `LETGO`; pure paths `cannonSpec`, `swingPath`, `sweepAngle`, `cannonShot`, `letGo`, `boatAt`, `boatState`, `boatKey`; `routeTo`, `pirateAim` |
| `src/pirateship.js` | T40b `SHIP` data + `buildShip`, `buildDock`, `hullRange`, `deckTop` |
| `src/pirateparts.js` | T40b `PirateLive` = `LIVE.pirate`: cannons, ropes, rowboats, the chest; `near` / `holds` / `release` (Fire! / Swing! / Let go!), registers `PATHS.swing`; `steady = true` (tests) = the old rides |
| `src/atlantisland.js` | T41 the Sunken City as data (Node-runnable): `CITY` (centre 270, 112), `BELL`, `WHIRL`, `BUBBLES`, `PALACE`, `DISTRICTS`, houses + `CORRIDORS` (7 dead ends); `atlantisLand` (called by `pirateLand` for maps wider than 224: sets `world.atlantis`, `deepAt`, `sinkAt`, `skyDim`, `sunkenY`), `dimAt`, `atlantisAim` |
| `src/glowfish.js` | T41, pure (no imports): `FISH`, the 12 saved lights (`lightKey`, `lightState`), lunge / net, shy jar fish, the school, `Darter` (1/120 s sub-steps) |
| `src/atlantislive.js` | T41 `AtlantisLive` = `LIVE.atlantis`: fish meshes, net, jars, whirlpool, bubbles, lanterns; Catch! (`holds` / `use` / `release`), `pour`, `syncLights`, `battleEnded`, `info()` |
| `src/portalhouse.js` | T42 the Portal House in the Swirl's north-east sky (Node-runnable; `buildPortalHouse` from `swirlLand`): `R` (x 85..159, z 0..31, y 1..47; owner 2026-10-27: no House block at z 32+ and none glows), `HUB`, `PORCH`, `HOUSE_LIFT`, `HALL`, `SWIRLS` (records with `kind`, `move`, `needs`), `ROOMS` (8), `houseAim` |
| `src/portalplay.js` | T42 pure swirl rules (imports only `mover.js`): `PORTAL`, `exitSpeed`, `exitOf`, `PATHS.fling`, `flingFlight` (checked every 0.02 s), `slotAimed`, the Swirl Ball, `roomKey(n)` = `pw:portal:room<n>`, `ROOMS_NEED` 8, `roomState` |
| `src/portalhouselive.js` | T42 `PortalHouseLive` = `LIVE.portalhouse`: the Wand, "Swirl!" (one tap, no hold), pads, going through and flings, doors and warps, the soft catch, the 4-loop stop, the Swirl Ball, sparks, `people` (drawn only in their own part), `battleEnded`, `manual` / `step` / `hold` for tests |
| `src/dreamland.js` | T35 Dream terrain (Node-runnable): `ISLES` (15), `LINKS`, `GIANTS`, `dreamLand` (cloud sea, islands, Bounce pads, Wake Stone, `world.isles`) |
| `src/dreamhouse.js` | T35 `buildDreamHouse`: the Upside-Down House gym (sets `world.healer`, returns the gym object) |
| `src/world.js` | Seeded terrain, biomes (`biome(x, z)`), plants, ores, `generate()` (T17/T32 chain of `SIZES`), `protectedAt`/`editAllowed`/`cull`, chunk meshing (solid / water / glowing), voxel raycast |
| `src/gymplace.js` | Gym and tower placement and buildings (`gymSpots`, `placeGyms`, `buildGym`, `pickSpot`, `placeTower`, `newLandSlots`, `southSlots`, `gymSlots`, `placeSlotGyms`, `SLOT_BUILDERS`), copied onto `World.prototype` by `installGymPlacement` |
| `src/homes.js` | T22 `Home` (record `{ owner, name, x, y, z }`, `results`/`types`, `spawnSpot`, `standSpots(n)`) and `HomeManager` = `game.homes` |
| `src/roomfinder.js` | `findRoom(world, x, f, z)`: the room around a Doormat -> plain report; knows no home type |
| `src/hometypes.js` | `HomeType` (`evaluate(report)`, texts), `GEMS_NEED`, `HOME_TYPES`, `addHomeType`/`removeHomeType`, Cozy and Treasure types + example houses |
| `src/homeui.js` | `createHomeUi` -> `game.homeUi`: meter, red gaps, floor outline, home panel, spinning example, treasure sparkle |
| `src/caves.js` | `carveCaves`, `carveBigCaves`, `planStairs`/`buildStairs`, the light shader (`caveLight`, `patchMaterial`), `swirlTint` (T38d), `sketchLook` / `patchSketch` (T45) |
| `src/blocks.js` | Block ids (wool 20–38, newer 40+), `PLACEABLE`, procedurally drawn atlas (`tileX/tileY/tileUv/tileGlY`, `MORE_TILES`), wool roof blocks, `limited` blocks (`TREASURE`, `isLimited`) |
| `src/species.js` | Types + effectiveness chart, moves (`moveInfo`), all species (7 per type) plus the legendary Zenithar (never in `SPAWNS`, not catchable, skipped by roster counts), spawn tables, XP curve, model builders + animation |
| `src/shapes.js` | Model-building helpers (`box`, `eyes`, `addWings`, `drift`, `crewStack`, `sparkleGeometry`, `buildGiftWrap`...) and the body shapes of the newer types (`SHAPES`, `SHAPES_SKY/SLIME/LIGHT/PAPER`, ...) |
| `src/gyms.js` | The gyms in difficulty order (teams, people, dialogue; `trainersOf(def)` / `trainerKey(def, i)`) and `TOWER` |
| `src/book.js` | Creature Book (C, `game.book`): seen/caught, pages, wiki links (T19.5: `go`/`back`, `open({ species, move, type, from })`, `typeLink`) |
| `src/battle.js` | Turn-based battles (wild and trainer), catching, XP share, evolution |
| `src/creatures.js` | Wild spawning (biome tables + conditions), wandering, `GAITS` (hopaway, blink, peek, dash, pop, gift, sentry), Camo disguises (`spawnAt`, `Wild.reveal`) |
| `src/spawnrules.js` | Spawn conditions as data: `CONDITIONS`, `goldenHour`, `condOf`, `condOk`, `HOME_SPAWN`, `afterOk` |
| `src/coopboss.js` | T29 co-op giants: `BOSSES`, `makeBoss(id, a, b, grow)`, `GROW` |
| `src/disguise.js` | `Disguise`: a creature or person drawn as a world block that blinks (Camo creatures, Hidden Hill trainers) |
| `src/npc.js` | Blocky people (trainers, leaders, healers, guests, Bosses, avatars); `look`s, `steer`, `lookout`, `cheer`; `NpcManager` (`placeAt`, `sendAway`, `disguiseAs`, `reveal`) |
| `src/player.js` | Player physics: walk, swim / `dive`, lifts, `carry` rides, trampolines, riding, bounce |
| `src/gymlive.js` | `createGymLive(game)` = `game.gymLive`: live parts of gyms and realm parts (`reset`, `update`, `stand`, `hit`, `prompt`, `of`, `near`/`use`/`holds`/`release`, `aim`, `talk`, `battleEnded`...); `LiveCells` re-exported from `src/livecells.js` |
| `src/daytime.js` | The Clock Tower's door windows (`WINDOWS`, `windowAt(t)`, `minutesUntil`) by `game.time` (T19) |
| `src/clocktower.js`, `src/hiddenhill.js`, `src/firewall.js` | T19 slot gyms: `buildClockTower` / `buildHiddenHill` / `buildFirewallMaze` (+ `ClockLive`, `MazeLive`) |
| `src/restaurant.js` | T33 Restaurant (slot 5): `buildRestaurant`, `RestaurantLive` (`LIVE.restaurant`), pure `dishIndex` / `orderState` / `sourcesFound` / `availableDishes` / `nearestSources` |
| `src/glint.js` | `Glint` ("glows faster the closer you get") and its instances `NEAR` (vault key, ingredients) and `SEEK` (hide and seek); every distance-blink in the HUD uses it |
| `src/homegym.js` | T23 Cozy Gym: `homeGymState(game, g)` (pure), `homeTypeFor`, `caughtOfType`, `HomeLive` (`LIVE.home`) |
| `src/treasurevault.js` | T23 Treasure Vault: `buildTreasureVault` (slot 4), `VaultLive` (`LIVE.vault`) |
| `src/dancefloor.js` | Echo Gym dance-off (`LIVE.dance`, `keys: ['danced']`): `DANCE`, `danceRounds`, `danceSteps`, `DanceLive`; pads drawn with `setLive`, no world block changed |
| `src/obstaclecourse.js` | T36/T36.5 Obstacle Course (slot 7): `PIECES` / `FLAGS` / `TIMES`, `buildObstacleCourse`, `CourseLive` (`LIVE.course`) |
| `src/racetrack.js`, `src/racelive.js` | T40c Race Track: `racetrack.js` (pure) `RACE`, `TRACK`/`CHAIN`, `makeTrack`, `bossSpeed`, `buildRaceTrack`; `racelive.js` `RaceLive` (`LIVE.race`), `buildKart` |
| `src/kart.js` | Race Track v2 (owner 2026-10-27), pure: `KART` (speeds by surface, grip, boost, ramp), `surfaceOf`, `Kart` (1/120 s sub-steps -> events) |
| `src/wildafter.js` | Owner 2026-10-27: `AFTER_CHECKS` (per Picture World: how far you must get before its big creatures appear), `wildAfter(game, id)` |
| `src/shadowdojo.js` | T37b Shadow Dojo (slot 8, gym 32): `DOJO` tunables, `buildShadowDojo`, `DojoLive` (`LIVE.dojo`) |
| `src/sneak.js` | T37b reusable sneaking pieces (no game imports): `Watcher`, `Hideout`, `FLOORS` + `FloorMap`, `Checkpoint` |
| `src/ballphysics.js` | T40d, pure: `Ball` (a cube of half-size 0.4, 1/120 s sub-steps), kicks and shots, keepers, `HOLD`, `kickZone`, `shotWindow`, `shotMiss`, `DIVE` |
| `src/stadium.js` | T40d Ball Stadium layout (`STADIUM`, `buildStadium`), `goalState` / `goalKey` / `basketKey`, `GOALS`, `SHOT` |
| `src/stadiumlive.js` | T40d `StadiumLive` = `LIVE.stadium`: balls, keepers, Dee and Bo, Kick! / Shoot! (held), the score chip, kind help (`misses.foot` / `misses.hoop`) |
| `src/fairgames.js` | T43, pure: the Funfair's games and rides: `BumperCar`, `BotFleet`, `BumperGame`, `BounceGame`, `Seat`, `HARD`, round tables, `makeCoaster`, `makeHelix`, `registerFairPaths` |
| `src/funfair.js` | T43 Funfair layout (Node-runnable): `FAIR`, `buildFunfair` (= `PLAYLAND_PARTS.fair.build`), `ticketState` / `ticketKey` / `TICKETS`, `FUNFAIR_SPAWNS`, `FAIR_WALK` |
| `src/funfairlive.js` | T43 `FairLive` = `LIVE.fair`: the three games, the coaster and the slide; `carry` objects (`carObj`, `seatObj`) and `Mover`s; `manual` + `step(dt)` for tests |
| `src/fairprops.js` | T43 the Funfair's models (instanced, vertex colours); `tests/funfair-preview.mjs` photographs them |
| `src/partyland.js` | T48 the Surprise Party terrain (Node-runnable, `TERRAINS.partyLand`, realm `doors`): `ROOM`, `SQUARE`, `SPINNER`, `CAKE`, `GUESTS`, `CRASHERS`, `setsOf()`, `bowKey` / `bowState`, `PARTY_MARK`, `partyBows` / `migrateBows`, `partyLand`, `partyAim` |
| `src/spinner.js` | T48, pure: the Party Spinner (`SPIN`, Stop! lands on the slice under the arrow; `skipTo` / `skipAngle`: it clicks on past won games), `GAMES`, `TWISTS` / `twistOf` |
| `src/partyrounds.js` | T48, pure: rounds and surprises wrapped round the unchanged piñata and Jack Catch rules |
| `src/pinata.js` | T44 rework (unchanged by T48), pure: the Piñata Party's rules (`PINATA`, `pinataPlan`, `whack`; `hashStr` / `seeded` shared with jackcatch.js) |
| `src/jackcatch.js` | T44 rework (unchanged by T48), pure: Jack Catch (`CATCH`, `catchPlan`, `stepCatch`) |
| `src/giftstack.js` | T48, pure: Gift Stack (release timing on a swinging crane: `STACK`, `stackPlan`, `drop`) |
| `src/popupwhack.js` | T48, pure: Pop-Up Whack (`WHACK`, `whackPlan`, `whackAt`) |
| `src/partylive.js` | T48 `PartyLive` = `LIVE.doors`: the Spinner, the four games (sets flip up with `LiveCells`), the crashers, the finale, "Lights out!" (`game.lightsDim`), the old-bow move; `manual` + `step(dt)` |
| `src/partyprops.js` | T48 the party's models (merged / instanced); `tests/party-preview.mjs` photographs them |
| `src/sketchatlas.js` | T45 look v2: `drawSketchAtlas` (a DATA atlas, same grid as the colour atlas), `KIND` / `KIND_OF` (pencil mark kinds per tile), `drawSketchMarks`, `ROTATE_KINDS`, `PAPER`, `INK` |
| `src/sketch.js` | T45 `createSketch` -> `game.sketch` (`reset(world)` swaps the block maps and the `SKETCH` define, `update` = the boil) and `sketchModel(group)` (pencil models; a no-op unless a sketch world is loaded) |
| `src/doodleland.js` | T45 Sketchbook terrain (Node-runnable, 160 x 160): `PAGES`, `LINES`, `COURSES`, `lineKey(n)` = `pw:doodle:line<n>`, `lineState`, `courseOf`, `gapBoxes`, `doodleLand`, `doodleAim` |
| `src/tracing.js` | T45, pure: `lineOf(def)` and **Draw!** (`DRAW`, `newDraw`, `drawStep` -> events, `FaceSteer` / `STEER`) |
| `src/doodlelive.js` | T45 `DoodleLive` = `LIVE.doodle`: Draw!, the pencil, Rubber, stars / blots / bees, ink with `LiveCells`, saved lines, `battleEnded` (clears lines 6-8), `manual` + `step` |
| `src/castleland.js` | T49 the Castle as data (Node-runnable, TERRAINS.castleLand, 160 x 160): walls, moat, towers, gatehouse, drawbridge, keep, Tilt Yard, maze field; `shieldKey` / `lanceKey`, `castleState`, `liveCells`, `castleAim`, `castleLand` |
| `src/hedgemaze.js` | T49 the hedge maze, pure: `MAZE` (seed 483; owner 2026-10-28: a way of 26 cells, 11 dead ends; it was seed 14), `mazeOf`, `mazeCells`, `mazeExtras` |
| `src/siege.js` | T49 Shield Up!, pure: `SIEGE`, `siegePlan`, `judge`, `SiegeRound` |
| `src/joust.js` | T49 the Joust, pure: `JOUST`, `joustPlan`, `meetResult`, `JoustRound` |
| `src/castlelive.js` | T49 `CastleLive` = `LIVE.castle`: the shield stance and the steed (`carry` objects), throws, gates with `LiveCells`, the Joust's view (`JOUST_VIEW`, owner 2026-10-28), the maze's fun (`MAZE_FUN`), `battleEnded`, `manual` + `step` |
| `src/castleprops.js` | T49 the Castle's models (`buildPracticeKnight` with its `parts.shield`, catapults, lance, drawbridge, portcullis, horseshoes, critters, spray) |
| `src/castlegate.js` | T49 the shared gates (owner 2026-10-28: physical): `createCastleGates` -> `game.castleGates`; play-together `castle` message, per session, never saved |
| `src/bubbleland.js` | The Bubble Well as data (Node-runnable, `TERRAINS.bubbleLand`, 160 x 160): `WELL`, `FLOOR`, `MESA`, `BENCH` (+ its overhang), `SHAFT1` / `SHAFT2`, `BREEZES`, `GARDEN` / `NEST` / `ISLANDS` / `THORNS` / `CURRENTS`, `CHIMNEY`, `RIM`, `VENTS` / `SHIELD`, `LIFTS`, `DRIPS`, `SOAP_FLOWERS`; keys `stairsKey` / `duckKey` / `chimneyKey` / `shieldKey`, `bubbleState`, `bubbleAim`, `bubbleLand` |
| `src/bubbles.js` | The Bubble Well's rules, pure: `BUBBLE` / `BubbleField` (Blow!, rise, pop, stand), `dripAt`, `DUCK` / `Duckling` (Puff! nudges), `RIDE` / `Ride` (the Chimney Ride: taps, plates, the arm), `SHOT` / `shieldShot` / `shieldSpot`, `HARD`, `bubbleHelp` (= the `kindHelp` mapping) |
| `src/bubblelive.js` | `BubbleLive` = `LIVE.bubble`: the wand, standing on a bubble (a `carry`: Jump = Bounce), falls back to your ledge, the ducklings, the ride (`carry`, Jump = Puff), the vents and shields, the fizz lifts (in `world.lifts` only while on), `battleEnded`, `manual` + `step`, `info()` |
| `src/bubbleprops.js` | The Bubble Well's models: one soap-film shader (`soapMaterial`), bubbles (instanced), aim ring, wand, drips, streams, soap flowers, thorns, nest, the chimney's plates / fan / arm / stars, shields |
| `src/bigtop.js` | T34 Big Top Gym (slot 6): `buildBigTop`, no live parts |
| `src/missions.js` | T29 Champion missions: `MISSIONS` (12, append-only), `REWARDS`, `loadMissions`, `nextMission`, `missionOf`, `createMissions` -> `game.missions` |
| `src/missiongen.js` | T38c the mission maker (pure): `makeMission(n, seed)`, `cleanSpec`, `roundKinds`, `roundOf`, pools, `MORE_SPOTS` |
| `src/treasuremap.js` | T29 `treasureSpots(world)` (5 spots from the seed), `moreTreasureSpots`, `spotOf`, `clueOf`, `drawMap`, `findCheck`, `MAP_RULES`/`MAP_LEGS`/`MAP_GYMS` |
| `src/buildcheck.js` | T29 `scanBuild(world, pos)` (placed blocks only) and `BUILDS`, `BUILD_TEMPLATES`, `makeBuild`, `buildOf` |
| `src/features.js` | T29 feature helpers (`count`, `hasBlock`, `atLeast`, `mostly`, `reach`, `different`, `checkAll`), used by homes and builds |
| `src/missionui.js` | T29 `createMissionUi` -> `game.missionUi`: the `#missions` panel and the `#mission-chip` |
| `src/ui.js` | HUD, team screen, creature portraits, `ui.ask`, `ui.celebrate`, chips (`setScore`, `setKeyCompass`, `setPointers`...) |
| `src/touch.js` | Tablet controls. **T39c fixed-slot rule: buttons never move or disappear, they dim** (`setButtons({ act, place, ride, jump, swim, sky, steady })` once per frame from `updateTarget`; DOM written only on change). Bottom right: Jump, the round Action button `#btn-act` (its word = what it does; it replaced Break), Place above Jump, Ride above Action (only with a rideable creature; in a world with `gravityAt` the same slot is **Steady**: lit = the steady camera on, dim = off), Down only while flying. A tap on a dimmed button toasts why (`game.touchWhy`). Top bar = only `#btn-pause` and `#btn-book`; Team = tap `#party-mini`, Blocks = tap the picked slot again, both also in the pause screen |
| `src/cloud.js` | Supabase: accounts, online saves, realtime channel |
| `src/multiplayer.js` | Play together: share code, avatars, block sync; T38b `realm` event |
| `src/duel.js` | Player-vs-player battles over the play-together channel |
| `src/traits.js` | T26 traits (no imports): `TRAITS` (only `rideable`), `hash32`, `drawTraits`, `cleanTraits`, `fixTraits`, `gainTraits`, `hasTrait` |
| `src/riding.js` | T27 riding: `RIDE`, `rideKind`, `rideSpecies`, `createRiding` -> `game.riding` |
| `src/weather.js` | Weather: shared phase, per-biome kind, particles, rainbow, lightning, spawn boosts (`game.weather.set` / `skip` / `info` for tests) |
| `src/fx.js` | Battle effects (`game.fx`): time-based, closed form, never touches `battle.rng`; budgets: 6 live effects, 300 points, 12 draw calls; `hold` for test screenshots |
| `src/fxrecipes.js` | `TRAVEL` / `IMPACT` per type, `SIG` per signature move, `FX_COLORS` |
| `src/sound.js` | Quiet Web Audio sound effects (`sound.play(name)`), on/off in the pause screen |
| `src/gravity.js` | Cube Planets (step 0), pure: `GRAV`, `FRAMES` (the 24 quarter-turns), `toWorld` / `toLocal` (exact), `turnTo` / `frameOf`, `downAt` (which planet by the body's middle, which side by the feet, hysteresis, soft pull), `centreOf` / `pivot`, `stepFlight` / `flightAt` / `flightLand` (the player's own sums), `frameWorld` |
| `src/cubeland.js` | Cube Planets terrain (Node-runnable, `TERRAINS.cubeLand`, 224 x 224): `PLANETS` (3), `BOXES`, `HOPS`, `hopSpot`, `FACES`, `faceCell`, `DOOR`; sets `world.planets`, `world.gravityAt`, `world.cubes`; `cubeAim` (the arrow in your face's frame) |
| `src/cubelive.js` | Cube Planets `CubeLive` = `LIVE.gravity`: the star sky (one `Points`), the planets you stood on (`visited`, the guide's tour), one-time words, the catch puff's toast |
| `src/steadycam.js` | Owner 2026-10-29: `steadyCam` (`on`, `setOn`), the steady camera setting, per device in localStorage `pokecraft-steady` like Sound (never in the game save) |

## Key ideas

### World, saves and the map

- The world is **deterministic from its seed**; a save stores the seed plus the list of player block edits (`world.edits`,
  index → block id). Gyms are generated, not saved, so changing `placeGyms`/`gymSpots` moves gyms in existing saves
  (`continueGame` moves the player to spawn if they would start inside a wall).
- Biomes only change surface blocks and plants; **terrain heights must stay the same** for old saves' builds to line up.
  Mountain/snow/peak use each map's own height percentiles (`highGround()`). `SPAWNS` has a table per biome (`blocks` and
  `roster` specs check coverage). Wild creatures wander off and day/night-only ones leave, so the 16-creature cap never freezes the mix.
- **Save format:** localStorage key `pokecraft-save-v2` (v1 saves migrated: team kept, new world). Saves record `size: [W, D]`;
  `convertEdits` moves edits from saves of another size (no `size` = the old 192×192 map). The same object is upserted to
  Supabase when signed in; the newer `savedAt` wins. Saves also have `seen` / `caught` (Book; `book.syncTeam()` = team + box
  caught), creatures have `uid` and `traits`. Other save fields: `badges`, `beaten`, `cubes`, `blockCounts`, `rematchWins`,
  `bossWins`, `keys`, `missions`, `champion`, `stars`, `homes`, `playerId`, `place`, `realmPos`, `realmEdits`, `realmVersions`, `realmUp`.
- **`WORLD_VERSION`** (multiplayer `world` message `wv`): bump it when blocks change for the same seed. It is **20** (T40); its history is the comment in `src/multiplayer.js`. Live blocks drawn with `setLive` never need a bump.
- **Map sizes (T17, T32, spec `big-map`):** the map is **288 x 368** (`WORLD_W`/`WORLD_D`; `OLD_W/D` = 224, `T17_W/T17_D` = 288,
  `MID_X/Z` = 112 = the start). `generate()` is a chain `SIZES = [[224, 224], [288, 288], [288, 368]]` (**never change an entry**):
  each size makes the one before in its own World, `adoptOld`s it, then `generateNewLand(IW, ID)`, `placeSlotGyms([first, last])`,
  `placeTreasure([IW, ID])`; `guardOld` makes `set()` throw inside the inner map. So the 224 and 288 maps are block for block the
  same inside (`old-saves`/`caves`/`map` checksums never change). **Never let anything that runs on the big world search the whole
  map for old content:** `gymSpots`/`extraGymSpots`/`towerSpot`/`highGround`/`startColumn`/`findSpawn` are pinned to `OLD_*`/`MID_*`,
  cave carvers and old spot searches (`legacyOnly(world)`) throw on a non-224 world; use `world.W`/`world.D` for strides. New land
  (x or z >= 224, and the south strip z 288..367) has terrain, plants (no trees within 2 of a seam) and treasure, no caves.
- **Gym slots:** `newLandSlots()` (0-4, T17) and `southSlots()` (5-9, T32, cached `world.south`; **never change `SOUTH` or the rule**),
  `gymSlots()` = both, index = `def.slot`. Slots: 0-2 T19 (Time, Camo, Cyber), 3 spare (players may have built there; stays empty),
  4 Treasure Vault, 5 Restaurant, 6 Big Top, 7 Obstacle Course, 8 Shadow Dojo, 9 spare. A slot builder lives in its own file,
  is registered in `SLOT_BUILDERS` (gymplace.js) as `(world, def, slot) => gym object`, writes only inside `slot.box`, sets
  `protect`/`area`/`trainerPositions` (`world.levelSite` helps; `world.stubSlotGym` is a stand-in).
- **Gym protection:** every gym and `world.tower` has `protect: [{x0,x1,y0,y1,z0,z1}]`; `world.editAllowed(x, y, z, id)` is the one
  rule (opening a chest is allowed), used by `breakBlock`/`placeBlock`, visitors' `block` messages and `applyEdits`. **A new gym
  builder must set `protect`.** Realms add `world.keeps` (`[{ name, protect, wallText, rideIn? }]`, nobody builds there). `World.cull` hides far chunks.
- **Caves** (`caves.js`) are carved right after the terrain loop and before plants, from the seed only, only below `ground - 3`, so
  the surface, gyms, tower and builds stay; only 6-8 entrance holes break the surface. `world.ground` = natural height,
  `world.top` = highest sky-blocking block, `skyAt()` / `underground()` say how dark a place is. `generate({ caves: false })` in tests.
  **Lighting is baked into vertex colours** (r = shade x sky light, g = shade x block light, b = shade); day/night is
  `caveLight.uLit`, the player's light `caveLight.uLantern`. Cave creatures come from `SPAWNS.cave`; chests `B.CHEST` -> `B.CHEST_OPEN` (+3 cubes).
- **Caves layer 2 and cave gyms (T8, `plans/T8.md`):** `carveBigCaves` runs after `carveCaves` (never changed) and the legacy
  `fillCavesNear` calls; own rand `mulberry32(seed ^ 0xb16ca7e)`, only ever adds air: halls (`caves.halls`), tunnels, lit
  stairways, lamp posts (`caves.marks`). `generate({ caves, bigCaves = caves, caveGyms = true })` order: terrain, v1 caves,
  legacy fills, big caves, `carveGymRooms`, plants, gyms 1-16, tower, `placeExtraGyms` (skips `place: 'cave'`), `placeCaveGyms`;
  then `gyms` is sorted into `GYMS` order. A `place: 'cave'` gym (Fossil, Goo) gets a 25-wide cavern at floor y 2 with stairs out
  (`caveGymSpots`, `carveGymRoom`, `world.litRooms`). **Never change the cave-gym mask, candidate order or `fy`** (it would move the
  gym). No room (about 1 seed in 100, e.g. 122) = built on its reserved surface spot. `gymAt(x, z, y)` matches cave and sky gyms only at their height.
- **Treasure blocks (T20, spec `treasure`):** Sunstone 65, Ruby 66, Sapphire 67 (`TREASURE`, `glow` + `noLight`). **Limited
  blocks** (`limited: true`) are placeable only while `game.blockCounts[id] > 0` (breaking adds 1, placing uses 1; `×n` and greyed
  at 0; save field `blockCounts`, `loadCounts`). `placeTreasure()` only turns natural `STONE` 4+ below ground into treasure (never in a
  `protect` box); the old area changed **on purpose** (`old-saves` counts treasure as stone for `SUM22`, `SUM` uses
  `generate({ treasure: false })`). Capture Cubes from blocks come only from natural blocks (`breakBlock` checks `world.edits`).
- **Block ids:** wool 20–38, newer blocks 40+; wool time 54, camo 55, cyber 56, cozy 68, treasure 69, sky 49, slime 50, light 51,
  paper 52, `B.CLOUD` 53; 57-64 T19 gym blocks; 65-67 treasure; 70-72 Doormat / Bed / Fireplace; 73 `KEY_CHEST`, 74 `VAULT_DOOR`;
  75-77 mission blocks (Star Block, Rainbow Brick, Giant Trophy: `limited` + `getMore`, never in the world); 78 Wake Stone;
  83-86 Restaurant pots and stove; 87 Bounce Block, 88 Dream Grass; 89-90 (`CRUMBLE`, `CRUMBLE_SHAKE`), 91-94 and 95-104 Obstacle Course (104 reserved);
  105-112 Echo Gym: pads 105-108, lit 109-112; 113 ninja wool; 114-123 Shadow Dojo; 124-131 Portal Door and Swirl; 132-136 Swirl looks (137-139 reserved/free);
  140-143 Picture World wool, 144-146 `PICTURE` / `WAY_BACK` / `BOSS_STAND`; 150-203 belong to T40a-d: 150-167 Giant House,
  168-181 Pirate Seas (182-183 were reserved for it; 182 is now T49's `HEDGE`, 183 free), 184-193 Race Track; 194-203 Ball Stadium; 204 atlantis wool, 205-214 Atlantis; 215 portal wool, 216-223 Portal
  House; 224 funfair wool, 225-234 Funfair; 235 surprise wool, 236-243 Surprise Party (235-243 in all); 244 doodle wool, 245-248 Sketchbook;
  249 `STAR_GRASS` (Cube Planets); 250 `HOUSE_PROP`; 251-253 Race Track v2 (`HOT_TRACK`, `HOT_RAIL`, `KICKER`); 254 knight wool; 255 bubble wool (147 `FOAM`, 148
  `FIZZ_WALL`). Ids are used up: free are only 137 (wave 17's Custom wool), 138-139 (spare) and 149 (Cube Planets' wool, waits for its type);
  Cube Planets took 183 `PLANET_ROCK` and 249 `STAR_GRASS`.
- **Block flags:** `glow`, `noLight` (glows but lights nothing), `wallText` (toast when breaking), `fixed` (`editAllowed` refuses;
  saved edits on it are dropped), `bounce` (T35: apex in blocks; **jump to launch**, not on landing), `trampoline` (T43),
  `hidden` (250 `HOUSE_PROP`: solid, never drawn, no outline: what you stand on under a model), `limited`.
- **Block atlas (wave 14.5, spec `blocks`):** a grid of 16 px tiles, `ATLAS_COLS` 32 wide, room for 1024. **Never compute a tile's
  place by hand:** use `tileX(t)` / `tileY(t)`, `tileUv(out, t, u, v)`, `tileGlY(t)` (for `copyTextureToTexture`; `flickerFire` /
  `swirlPortal` return `{ frame, x, y }`). A new tile = a `MORE_TILES` name. The fire tile alone is uploaded each frame
  (`texture.needsUpdate` on the whole atlas cut the frame rate to a quarter).
- **Live blocks:** `world.setLive(x, y, z, id)` redraws a block for this player only (never an edit, never saved or sent). Doors,
  lasers, lit lamps etc. go through `LiveCells` (never turns solid inside the player). **Gym files must import `LiveCells` from
  `livecells.js`**, because `gymlive.js` imports them (a cycle breaks `LIVE`). **A live object must not have its own
  `stand`/`hit`/`prompt` methods unless it means the `gymLive` hooks.**

### Gyms

- **`GYMS` is appended to, never reordered.** 32 gyms; the Champion's Tower needs all of them (`GYMS.length`, 32 since wave 12; it
  never grows again). The HUD shows badges in an 8 x 4 grid (`#badges`).
- **Gyms 17+ (Fossil = Bone, Saucer = Alien):** the first 16 come from `gymSpots(ORIGINAL_GYMS)`, 17-18 from `extraGymSpots()`
  (`EXTRA_GYMS_END = 18`). **Never change either or call `gymSpots` with another count.** Caves are filled within 18 of the extra gyms
  (`fillCavesNear`); `generate()` places the 16 gyms, the tower, then the extras so nothing old moves.
- **Gyms 19-22 (T10): Sunbeam, Origami, Goo (cave), Cloud (sky).** Spots from `newGymSpots()` (cached, terrain only; skips defs with
  `slot`, `home`, `realm`); cave defs first (`caveGymSpot`; `null` = surface fallback, e.g. seed 22), then `pickSpot` in `GYMS` order.
  **Never change the spot rules.** `place: 'sky'`: a `B.CLOUD` island with a ground landing pad (`gym.pad`); build a pillar on the pad
  to reach it. `world.newGymBoxes` are the only places T10 (and later the Portal Door) may change the T8 world (`old-saves` `SUM22`).
  `def.night` (Comet, Saucer: people only at night, `def.nightText`). Person `look`s: `alien`, `star`, `chef`, `sport`, `ninja`,
  `mouse`, `pirate`, `helmet`, `crown`, `swirl`, `fair`, `knight`, `squire` (npc.js).
- **The Saucer Gym floats (wave 6):** `place: 'sky'`, built by `placeExtraGyms` with `placeSkyGym(spot, 'saucer')` at its unchanged
  `extraGymSpots()` x/z; floor `saucerFloor()` = `min(35, maxG + 12)` (capped: hills within 13 cut, plants within 16 cleared). Its ±18
  box is in `world.newGymBoxes` (`SUM22`/`SURF` re-measured).
- **Gym defs (T19):** `slot`, `build`, `live`, `access`, `welcome`, `leaderWhere`, **`trainers: [{ name, colors, team, intro?,
  opens?, disguise? }]`**; the 22 old gyms keep `trainer` + `trainerTeam`: use `trainersOf(def)` / `trainerKey(def, i)` (first trainer
  key `<id>:trainer`, second `<id>:trainer2`). **No T19 access piece may define `tips`** (the access golden would change); same for
  later `WHERE` entries (`course`, `dojo`, `home`).
- **Gyms 23-25: Clock Tower / Hidden Hill / Firewall Maze (T19, slots 0-2):** `WHEN.clock` (door windows from `daytime.js`). Hidden Hill: hill
  of the column's own blocks, hidden tunnel; `protect[0]` is ONE box holding room and tunnel; trainers with `disguise: 'stone'`
  (`NpcManager.disguiseAs` / `reveal` / `undisguise` / `onBump`). Firewall Maze: `ROOMS` = three laser grids (`solveRoom` BFS: fewest
  presses 1/2/3, no trap); `MazeLive`; the friend lane opens while another player stands on a pad; exit door (T23.5) opens only from
  inside the server room (one-way). No world block changed, no `WORLD_VERSION` bump.
- **Gym rematches (T28, `src/rematch.js`, spec `gym`):** once you hold the badge, talking to the leader asks (`ui.ask`), then
  `rematchTeam(def, wins)`: tier = wins + 1, +3 levels per tier (cap `REMATCH_CAP` 70, shared with the Champion), evolved, plus
  extras. Win: `min(8, 3 + n)` cubes. Save field `rematchWins` (`loadWins` drops junk), per player.
- **Champion's Tower:** `placeTower` right after `placeGyms` (23+ blocks from every gym; never moves gyms). People `kind: 'tower'`
  with `role` (`guard1`, `guard2`, `coach`, `champion`). Everyone refuses until all badges (also old Champions:
  `TOWER.locked(n, champion)`). `beaten` gains `tower:guard1/2`; save boolean `champion`. Boss battles `boss: true` (Zenithar hangs
  on once, powers up at half HP); the coach `xpBoost: 2`. After 16 badges (or the title) wild creatures get +10 levels
  (`creatures.levelBonus`). Since wave 12: guards 57-60, Champion 59-62 (Zenithar 62), Coach Dex up to 64 (14 teams).
- **Restaurant (T33, slot 5, gym 28, spec `food`):** state only in `game.keys` (`food:order|cooked|served`, `food:<ingredient>`);
  the dish is the next one **this map can make** (`sourcesFound` scans natural breakable blocks; `world.foodSources` in tests).
  New `gymLive` hooks `talk`, `talkPrompt`, `broke`, `battleEnded`; customers are `kind: 'guest'` people; the pot uses
  `performance.now()` (tests set `live.now`). `game.rematch.start(npc, intro)`.
- **Big Top (T34, slot 6), Echo Gym dance-off** (`dancefloor.js`, spec `dance`: pads drawn on the old building with `setLive`, no
  world block changed, old saves keep badge / trainer / wins).
- **Obstacle Course (T36b + T36.5, slot 7, gym 30, spec `parkour`):** a tall timed course of `PIECES` (`[id, d0, d1, s0, s1, h,
  kind, extra]`, kinds plat / beam / crumble / blink / zap / spring), 4 flags, trainers on flags 1-2, the leader on the finish.
  Flashing states are drawn only with `setLive`; every state is a closed form of `CourseLive.clock` (summed clamped frame dt); only
  elements within 14 animate. A fall goes back to the furthest flag; leaving `gym.area` resets flags. **Jump rules:** flat 4 air
  blocks, up 1 about 3, up 2 impossible, a spring 4 up / 7 flat; landings 2+ long; no jump may skip a flag (spec D2/D3). Checkpoints not saved.
- **Shadow Dojo (T37b, slot 8, gym 32, spec `dojo`):** watchers (all guards; owner 2026-10-24: guards never battle and always keep
  walking) on closed-form paths; spotted (cone, line of sight, not hidden, not by a lantern, `canSpot()`) = a puff back to the last
  stone lantern; running on squeak floor makes them look. The masters (keys `ninja:trainer` / `ninja:trainer2` as before) stand on the
  pagoda deck facing the gate (`npc.lookout`); **surprise attack** from behind = `startBattle({ surprise: true })`, the ally moves
  first in round 1 before any draw. Live parts steer people with `npc.steer`.

### Homes and the Treasure Vault

- **Homes (T22, `plans/T22.md`, spec `homes`):** blocks Doormat 70, Bed 71, Fireplace 72 (the fire flickers: only that tile is
  uploaded). The room finder (`roomfinder.js`) checks columns around the mat (size >= 8x8, walls, door, roof, zones). **Types are
  data:** `HomeType.evaluate(report)`; **T30.5: a home is every type it qualifies for** (no `type` in records); nothing else knows
  "cozy"/"treasure": a new type is `addHomeType(new HomeType({...}))` + a `home:<id>` entry in `SPAWNS`. Ownership by `game.playerId`
  (random, saved); one home per owner and per mat; homes are saved in the world part (`homes`). `world.onEdit` marks homes dirty;
  play together sends `home` messages. A broken Doormat removes its home; placing a second one turns your old mat into Planks;
  an orphan mat can be claimed (`homes.claim`). `GEMS_NEED` 15 (gems in wall, floor and roof).
- **Gyms 26-27: Cozy Gym (T23, `place: 'home'`, `HomeLive`):** no building (`homeGym(def)` has `x/y/z: null`: tests filter `!g.home`). Its
  people are `Npc.away` until `npcs.placeAt` / `sendAway`. Only the world owner's browser moves the gym in (`homes.setGyms`, a
  knock); a chilly home (needs 3 of its 5 things) says "Brr".
- **Treasure Vault (T23, slot 4):** three keys (dig, build, explore chests) in `game.keys` (`'<gymId>:<key>'`, save field `keys`,
  `loadKeys` drops unknown ones); `VaultLive` holds no state, it draws from `game.keys`; the key compass uses `Glint`.

### Creatures and spawning

- **Adding a creature:** add to `SPECIES` (`learn: L(type, secondType)`) and to a biome in `SPAWNS`; the model is built from `shape`
  plus `extras`. **The owner wants creatures to look unique:** a new family gets its own body shape (a new builder in shapes.js),
  not a recolour; evolutions may share it. The `roster` spec requires at least 3 shapes per type, 7 creatures per type.
- **Adding a type:** `TYPE_COLORS`, `EFFECTIVENESS` (the newer types add their row and cells as **separate statements**, never an
  edit of an old row: T21's and T44's specs check old cells unchanged; a defender may be weak to at most 5 types), two moves +
  `T1`/`T2`, a wool colour if it gets a gym, `TRAVEL` / `IMPACT` / `FX_COLORS` in `fxrecipes.js` and an `fx:<type>` sound (the `fx`
  spec checks both). A new signature move needs a `SIG` entry. Remember the README tables.
- **Spawn conditions (T18, `spawnrules.js`):** the third entry of a `SPAWNS` entry names a `CONDITIONS` entry; `share` takes that
  share of spawn attempts, `max` caps how many are alive, creatures leave when their condition stops (`condOk`). `creatures.env`
  (set in main.js) gives time, other players, homes; `creatures.context()` builds what conditions read. Golden hour = 1 minute around
  sunrise (04:30-07:30 on the HUD clock) and sunset (16:30-19:30). `home:<type>` (T21): `HOME_SPAWN` (cozy 1/60, x1.5 evening, x2
  `full`; treasure 1 in `max(300, 1500 - 40 * (gems - 15))`), `max: 1`, `place` = `home.spawnSpot()`. Other conditions: `high`
  (perches, T36), `evening`, `nook` / `gift` / `housefloor` (`world.nooks`), `crumbs`, `guardpost`.
- **Picture World creatures are rare (owner 2026-10-27):** a realm def may have `wild: { max, every }` (`pictureRealm` 5 / 2 s, the
  Swirl 4; main world 16 / 0.6 s); a spawn entry's 4th element names a Picture World id = only after you got a bit further there
  (`wildafter.js`, `creatures.env.after`, `afterOk`; the Book adds `AFTER_TEXT`). The big evolved forms of every Picture World type use it.
- **Camo creatures:** `disguise: { blocks, size }`: dressed as the most common of those blocks nearby, never walk, blink, battle when
  hit / tapped / walked into, `Wild.reveal()` pops them out. **Never call `disposeModel` on a disguised model without
  `disguise.dispose()` first** (it would free the shared world material). A disguise never changes the world, is never saved or sent.
- **Treasure sparkle:** `parts.sparkle` = 5 unlit glints (MeshBasic, no `emissive`: `tintModel` skips them).
- **Gaits** (`creatures.js` `GAITS`, all closed form, no `Math.random`): `hopaway` (Parkour, T36a: hops away, tired after 3; owner
  2026-10-26: a gait bump is only noticed, E / a tap battles; only a disguised Camo creature battles on bump), `blink` (Ninja, T37a:
  run at it faster than 5.2 within 8 and it vanishes in a puff to a legal spot 4-7 away; tired after 3; a "walk up slowly" tip once
  per session), `peek` (Tiny), `dash` (Racer), `pop` (Portal), `gift` (Surprise: wrapped in a gift box, gold paper when
  `baseXp >= 100`, `unwrap()` on reveal), `sentry` (Knight). `game.toldOnce` = once-per-session hints.
- **T9 types (Sky, Slime, Light, Paper):** creatures in `/* ==== T9 x ==== */` sections of `SPECIES`, shapes in
  `SHAPES_SKY/SLIME/LIGHT/PAPER`, spawns in `SPAWN_SKY/SLIME/LIGHT/PAPER`; Origrane is Paper, Puzzlet is Mind's 7th (`plans/T9.md`).
- **7th creatures (T4b):** single-stage with its own shape; `SPAWNS` gets them from `SEVENTH_A/B/C` (spec `seventh`).
- **Traits (T26, spec `traits`):** `traits: string[]`, set once in `makeCreature` from its `uid` (`drawTraits`: hash below
  `chance`, no extra `Math.random`) and saved, so a later list or chance change never takes one away. Old saves: `continueGame` runs
  `fixTraits` (missing `uid` -> `'o' + hash32('where:index:species:level')`) so every device gets the same result. Evolution only
  adds. Only `rideable` exists (`TRAITS.rideable.species[id]` = land / water / sky). Duels send and clean traits; no `VERSION` bump.
- **Jumping is the same at every frame rate (owner 2026-10-29, spec `jump`):** `Player.update` cuts a frame into sub-steps of at most
  1/60 s (`STEP`, `walkStep`), and on land a step moves along the exact parabola of the old 60 fps sums (a launch at V starts at
  V + half a 60 fps gravity step; `vel.y` keeps its old per-frame meaning, so code that sets it is unchanged). 20 / 30 fps now give
  exactly the 60 fps steps (before, a 20 fps jump reached 1.54 instead of 1.39), 120 fps the same arc. A landing ends the frame on
  the ground (no new launch before the next frame), so stand hooks still see it. Carry rides, sky riding, the dive and the Cube
  Planets frame branch are not sub-stepped (they have their own rules). `tests/fixtures/cube-off-golden.json` was re-recorded for
  this (its script has uneven frames; at a steady 60 fps old and new agree). **Jump latch:** a Space keydown / Jump touch down sets
  `keys.jumpTap`; the next `update` treats Space as held for that one update even if it is already up again (a tap shorter than a frame).
- **Riding (T27, spec `riding`):** physics in `Player`; riders are fenced out of every `protect` box (`world.fenced`); sky cap =
  floor + 6 (`WORLD_H` is 48). Not saved; visitors get `state.ride` (or `game.rideShow`).
- **Squad crews (T34, spec `squad`):** `weakensWithHp: true` (never a type check): `hpPower(c)` = 0.6 + 0.4 x HP fraction,
  multi-hit x1.2 against them; no new draws; models show `ceil(frac x n)` members only in battle (`setModelHealth`).
- **Dream look (T35):** every Dream creature's parts float apart (`drift(parts, group, amp, speed, phase)`, only upward).

### Battles and moves

- **Moves (`MOVES` in species.js):** `fx.kind` heal / raise / lower / flinch / sleep / multi / recoil; flags `sure`, `priority`,
  `sig`. Ids are saved, names are display only. **Never name a move like a sound effect** (`useMove` plays `sound.play(moveId)`).
  T24: multi-hit 1-5 (`HITS_1_5`), sleep = 2 or 3 turns + one free turn, a sleeper takes x1.25, a 3rd hit wakes it. Stat steps and
  sleep live in `battle.modMap` (never saved). `c.learned` lists offered moves; `gainXp(c, xp, { ask: true })` returns learn
  messages (old saves: `OLD_MOVE_IDS` count as offered).
- **T25 big moves** (`plans/T25.md`): 61 moves in 7 kinds (`rally`, `shield`, `risky`, `sacrifice`, `curse`, `field`, `lastword`),
  `big: true`, learned at `BIG_LEVEL` through `BIG` in `L()`; they use `odds`, never `chance`, and have no `sig`. Wild creatures
  and trainers never get them (`autoMoves`); leaders through `movesWith`; rematches at tier >= 3. Team state in `battle.sides`,
  `battle.field`, `battle.round`.
- **Duel safety:** both browsers work out each turn from a shared seed (`battle.rng`). Draw order in `useMove`: hit, number of hits,
  crit, damage roll, risky coin (7), curse roll (8), effect chance, sleep length; **nothing may branch on `side` before a draw.**
  `duel.js` `VERSION` must be bumped when battle rules change; it is **12** (8 T24/T25, 9 coop ask, 10 Squad, 11 grown giants, 12 creatures up to Lv 100).
- **Pointer lock:** with a mouse the browser only lets the game capture the mouse after a click. That's why battles end with a
  "Continue exploring" button and the pause screen exists.

### UI and play together

- **One-button answers (T39b, spec `asks`):** every question uses `ui.ask({ text, yes, no, onYes, onNo, kind })` (bed, rematch,
  follow, hide and seek, duel / co-op invite). **Yes** = E, Enter, a tap on the action button, a click while locked, Y, the Yes button;
  E / Enter / tap / click only as a fresh press at least 350 ms (`'mine'`) or 1 s (`'incoming'`) after it opened (`ui.canConfirm`,
  `ui.askYes`). **No** = Esc, N, Backspace, "Not now", losing the mouse lock, walking away, the timeout. Space is not an answer.
  While `ui.asking`, E / tap / click / Break / Place never also act. Specs click `#ask-yes` / `#ask-no` via `page.evaluate` or call
  `ui.askYes()` (a real Esc would be a no).
- **Where to go (T39a, spec `nav`):** the panel only changes which place `guide.js` follows (`game.nav.update(p)`; no choice = the
  old code path, the access golden stays identical). A gym row's arrow IS `game.access.of(gym).aim(p)`. Food ingredients, vault keys,
  treasure spots, the hide-and-seek friend, Camo creatures and Dojo guards are never destinations. The choice is not saved. A new
  place = a source in `DESTINATIONS`.
- **Hide and seek (T30, spec `hide-seek`):** two players over the `hs` event (`HS.VERSION` 1); the inviter leads (clock, score,
  times sent as ms left, never clock times); roles swap each round (hide 60 s with a dark screen, seek 180 s with a hot/cold
  compass); the play area is a circle of radius 40 plus gym boxes (`fence`); a disguised Camo creature near the hider sends `help`. No battles or riding during a game; nothing saved, no world change.
- **Champion missions (T29/T38c, specs `missions`, `missions-coop`):** Champion Solenne opens the panel. **`MISSIONS` order is
  append-only (ids are saved).** Save field `missions` = `{ active, done, last, next, gen, seed, spec }`; after the 12 hand-written
  ones the maker gives `gen:<n>` (pure `makeMission(n, seed)`, no `Math.random`, same on every device; `seed` = your OWN main-world
  seed, never a visited world's). `missionOf(state, id)` for anything that can be `gen:`. **`treasureSpots(world)` is a pure function
  of seed and terrain** (never `MAP_RULES`/`MAP_LEGS`; pinned to 288 x 288; `MAP_GYMS` 27); `moreTreasureSpots` (24 spots, pinned to
  288 x 368, keep-out = the first `MORE_GYMS` 32 gyms' boxes). **Later main-world gyms must stay 12 blocks away from both spot
  lists** (add to `MORE_GYMS` only with a new spot list). Builds count only placed blocks (`scanBuild`). Co-op giants
  (`coopboss.js`): the friend's creature is side `'friend'`, the giant acts by a fixed plan, `GROW` (level cap 55 + 2 per step up to
  `REMATCH_CAP`), the ask carries `grow`.
- `window.pokecraft` is the global `game` (tests and console): `world`, `player`, `party`, `box`, `badges`, `beaten`, `cubes`,
  `battle`, `mp`, `npcs`, `creatures`, `weather`, `rematchWins`, `bossWins`. Weather is not saved; the host sends its phase to visitors.

### Realms

- **Realms (T31, `plans/T31.md` §9, spec `realms`):** a realm is a small separate World (`new World(seed, scene, materials,
  def.size, def)`; `world.realm` = the def; `generate()` starts with `if (this.realm) return generateRealm(this)`, so the main
  path and checksums are untouched). Only one place is loaded: `game.place` = `'main'` or a realm id. The main world waits in the
  realms `stash` (friends' messages for main go into it). **Save:** in a realm, `snapshot()` = the stashed main part + `place` +
  `realmPos`; `realmEdits: { id: [[i, b]] }` plus `realmVersions`; `cleanRealmEdits(edits, versions)` drops a realm's edits when
  its saved version (missing = 1) differs, unless the def has `convert` (`convertRealmEdits`) or `sameCells` (versions whose cells
  still fit); then `restore` also keeps `realmPos`. Old saves (no `place`) load in main. Realm defs carry `spawns`, `walk`, `look`
  (sky, fog, `light`, `still`), `gravity`, `levelBonus` / `levelCap`, `timeSpeed`, `morning`, `wild`. No weather, no homes, no
  Doormat, map missions pause. **Play together:** `state`, `block`, `world` carry `place`; an avatar in another place is not drawn,
  not pickable, not in `friends` or hide and seek.
- **Realms together (T38b, spec `realms-together`):** a guest only *follows* the host (no Bed, night or title needed). **The host
  owns the realm's edits:** a guest has `stash.guest = true`, `realms.edits()` returns only the guest's own lists and `leave()` does
  not write `game.realmEdits`, so **the host's realm edits can never land in the guest's save**. Message `realm` (guest `ask` ->
  host `part` / `no`); `realms.follow()`, `offerFollow()`; a guest whose host left the place leaves too. **Generic, no realm ids in
  the follow code:** realm def fields `away`, `returned`, `askFollow`, `followText`, `joined`, `too`, `guide`, `entrance` +
  `guestNote` (all optional). The host's entrance rules (Bed + night, Champion title) live in the entrance code (`useBed`,
  `portal.use`), never in `enter`, so a following guest skips them.
- **Dream realm (T35, specs `dream`, `realms`):** reached through a Bed inside YOUR finished cozy home at night (ask, then
  `realms.enter('dream', { bed })`); back by the Wake Stone (78), morning, or a lost battle. `REALMS.dream` version 2 (T31's island
  was 1), 256 x 256 (a 192 fallback drops `outer` islands), `gravity` 0.5 (jump speed 8.6 stays, so jumps go twice as high),
  `timeSpeed` 0.5, `levelBonus` 6, `look.light` 0.8. Islands as data (`ISLES`, `LINKS`, Bounce pads: jump to launch), `routeOf` for
  the guide. **Realm gyms:** a GYMS def with `realm: '<id>'` + `build` is built by `generateRealm` through `REALM_BUILDERS`; the main
  world gets a stand-in (`World.realmGym`, `x` null; specs use `g.x != null` for "has a building"). The Upside-Down House sets
  `world.healer` (Healer Stella). The morning never wakes you in a battle or duel invite. The Wake Stone wakes you when used or broken; a Bed is used with E /
  tap / the action button (a mouse click still breaks it). `World.gravity` (`realm.gravity ?? 1`) is read once per `Player.update`.
- **Portal Door and the Swirl (T38a, spec `swirl`):** the Portal Door stands at `d 7, s 3..7` of the tower (its box appended to
  `tower.protect` and `world.newGymBoxes`), drawn with `setLive` for a Champion; `generate({ portal: false })` leaves it out
  (`old-saves` `SUM`; `SUM22`/`SURF` re-measured with the box left out). The Swirl (`REALMS.swirl`, 160 x 160, **version 5** with
  `sameCells: [4]`; owner 2026-10-26: 12 stars, all from Picture Worlds, 11 frames, 12 bridge stones, the Wizard's island at x 142; owner 2026-10-29: `FRAME_MOVED` / `frameSpotOf(id)` say which spot a frame hangs on (Giant House N5, Atlantis N0 beside the Pirate Seas, Gravity S2), the blocks stay the same;
  versions 3 and older are dropped): hub deck, galleries with picture frames, stairs, six **lift streams** (`world.lifts`,
  `world.liftAt(pos)` read by `Player.update`; no blocks), the **star bridge** (a `STAR_STONE` per star in `game.stars`, else a
  gold outline), the sealed Wizard's tower. Gravity 1, no morning. Save field `stars` (`loadStars`). `perf.mjs --swirl`.
- **Swirl looks (T38d, spec `swirl` 15-22):** four zone moods (`ZONES`, `zoneWeights`). **The block gradient is a tint in the shared
  shader** (`caves.js` `swirlTint`, tiles inside `uTintU` ranges take the zone colour); `uTintOn` is 0 outside the Swirl, so the main
  world and Dream are bit for bit as before; player-built blocks keep their colours. `game.swirlSky` (sky dome, fog, puffs as
  camera-facing quads, not GL points); all its meshes carry `userData.swirlSky`, are never blocks or saved, removed on `reset`.
  Puffs stay 10+ and floaters 5+ blocks from walkable cells. Swirl weather is always `clear`.

### Picture Worlds

- **The base (T40, `plans/T40.md`, spec `picture-worlds`):** a ready frame (`PICTURE_WORLDS[i].ready`, `PICTURE` cells + a canvas
  picture) opens the entry's `realm` (Race Track, Ball Stadium and Funfair share `playland`; each frame has its own arrival
  `world.arrivals[<id>]`). **Each task flips its own frame to ready.** `pictureRealm(d)` makes the realm def (`parent: 'swirl'`,
  `entrance: 'frame'`, `lose: 'stay'`, `levelBonus` 33 / `levelCap` 45, follow words). **Travel is one level deep:**
  `stash.up = { id, ret, via, edits }`; `leave()` goes up (`{ home: true }` straight to main); save field `realmUp`. Losing keeps you
  in the world (`realms.lost()`: nearest `world.rests`, healed). **Ways back** are `world.doors`; the door you use decides where you
  come out (owner 2026-10-26: `TERRAIN_RETURNS.swirlLand` = in front of that door's own frame). **Bosses** give a star and the
  Wizard's note (`ui.celebrate`), rematches grow like T28 (`bossWins`, `REMATCH_CAP` 70); `Npc` kinds `boss` / `crew`. **Live parts:**
  `world.parts` -> `LIVE[part.live]` with hooks `near(p)` / `use(p)` (the big button's word: "Fire!", "Kick!"), `holds` / `release`
  (hold and let go), `aim(p)` (the realm guide asks it first), `talk`, `talkPrompt`, `battleEnded`; `game.playing()` freezes clocks.
  Keys `'pw:<id>:<name>'` in `beaten` pass `loadKeys`. A ride that carries the player is a `Mover` or a duck-typed `carry`
  (`where`, `wantsLeave`, `leave`, `steer`, `look`, `safe`); `world.people` are guests of a Picture World.
- **Open worlds (owner 2026-10-28, `comingsoon.js`):** outside `?preview` only `OPEN_NOW` worlds are open (`fair`, `atlantis`,
  `doors`, `castle`, `doodle`; `worldOpen(id)`; spec `comingsoon`); `worldOpen('atlantis')` sizes the Pirate Seas. A `LATER` world (wave 16's
  `bubble` and `gravity`) is a covered secret frame; saves keep its star, keys and edits.
- **Levels (owner 2026-10-28):** creatures grow to `MAX_LEVEL` 100 (was 60; duel `VERSION` 12). Picture World Bosses and crews get
  `BOSS.perStar` (2) levels per star held from other worlds, up to `BOSS.starCap` 95 (`starTeam`).
- **The rules every world shares (owner 2026-10-27/28, `plans/T46.md`):** every Boss with helpers battles only once they are beaten
  (`crewLeft` / `crewText` / `bosses.crewAim`, the guide's first stop); clocks are summed dt with fixed sub-steps (60 and 20 fps the
  same), standing still in a battle / ask / panel / pause; a miss never fails, it starts the round again. **Kind help (owner
  2026-10-28, spec `kindhelp`):** every skill game gets *only ever so slightly* easier after misses in a row, only through
  `kindHelp(misses)` (no help for 0-1 misses, +2 % a miss, at most 10 %); each game only maps `slow` / `more` onto its own levers;
  no per-game help tables (the old ones are gone). A rematch's `hard` (you hold the star) is separate. "We should ask a bit of grit /
  patience from players." A won Boss battle clears that world's round keys, so a rematch plays the challenge again.
  **For fun (owner 2026-10-28):** every skill game stays playable once won: it plays its rounds again just for fun (`forfun.js`
  `ForFun` / `FUN.tag`) and saves nothing new (no key, bow, light, first-time reward or gate change). The Party Spinner skips games
  whose bow you hold (`skipTo`) until all four are won, then any slice is played for fun; Atlantis' fish swim back at 12 lights; a
  drawn line's pad says "Draw again!" (`doodlelive.js` `Lift`: its bridge, also a rematch's cleared line, is lifted while you redraw
  it and comes back on Stop, a finish, walking away (`DOODLE.away`) or a reload); the Race Track races again while the crew wait or after a "Not now" (`gymLive.bossDeclined`).
- **Owner's smaller notes (2026-10-27/28, `plans/T46.md` parts 2-3):** Doodle: mesh counts come from `COURSES`; Atlantis: `VIS` (halos, 4 bulbs per lantern, a trail to the lantern, ghost fish `demo` until the first
  catch), darker districts (`dimAt` LOW 0.22, the water `cityDimE`), soft glow sprites, fish that get away better (`FISH`); Bumper
  Cars 4 / 5 / 6 balloons; the Portal House's aimed pad no longer blinks.
- **Giant House and Tiny (T40a / T40a.5, spec `tiny`, `tests/housecheck.mjs`):** owner 2026-10-26: "more puzzles, less walking",
  the visuals must say what a thing is (`houseprops.js` models; 250 `HOUSE_PROP` under them). 1 block = 3 cm, 192 x 192, no ceiling.
  One way to Nibbles (Boss `house` in the cookie fort), four puzzles each with a crayon note: towel + wind-up key (the fan lift),
  plug + tap (the river), yarn + cat, marble + spoon fling (the fort's back door opens only from inside); the train; secret ways:
  the mouse hole and the keyhole. 12 crumbs (`pw:house:crumb<i>`, the only thing saved; Pipsqueak's `crumbs` condition).
  `REALMS.house.version` 2. Tiny creatures live only in `REALMS.house.spawns` (`nook` condition, `gait: 'peek'`).
  `housecheck.mjs` proves the Boss needs all four puzzles and not fewer, the secret ways, nobody stuck.
- **Pirate type and the Pirate Seas (T40b, `plans/T40b.md`, spec `pirate`):** type `pirate` (Parroteer > Featherbeard, Pinchook >
  Anchorclaw, Bottlet > Shipshape (rideable on water), Lookapus; every model wears `bandana` + `gold` gear), only in
  `REALMS.pirate.spawns` (islands / sea by `world.realmBiome`). Realm `pirate`: 7 islands in a sea to y 12; **cannons** = `Mover`s on
  `arc` paths, **ropes** = `PATHS.swing` (ends 1.5 above the stand so the box clears the edge), **ladders** = `world.lifts`; keeps cover
  pads, targets, stands, the ship; `world.rests` per island. Captain Squawk is a creature Boss (giant Featherbeard) with three crew;
  the chest is drawn from `game.stars`. **The challenges (owner 2026-10-26, "some dexterity", later "way too easy"):** island
  cannons swing (`sweepAngle`, slower after a miss); hold **Fire!** for range, let go to fire; hold **Swing!**, let go to drop
  (`letGo`: far / back / splash); white dots preview the landing. **Rowboats:** 12 in 4 waves of 3 on figure-eights, sunk with the
  two swivel cannons on the north rail; keys `pw:pirate:rowboat1..12` (`boatKey`; the first version's `pw:pirate:boat1..3` are
  dropped); the Captain's `gate` waits for all twelve and the three crew; afterwards boats row just for fun. Specs use `lv.steady = true`.
- **Atlantis, the Sunken City (T41, `plans/T41.md`, spec `atlantis`):** its own type (`atlantis`: the old city's guardians, glowing
  `rune` gear; chart: it hits pirate, camo and time) in the **Pirate Seas**: `REALMS.pirate` is **320 x 224, version 2** with
  `convert: { 1: [224, 224] }`; `pirateLand` is block for block the same inside x < 224 (the spec hashes it; the strip has its own
  pass and `rand`). Frame `PICTURE_WORLDS.atlantis` (was `secret2`), arrival in the diving bell, open from the start. **Swimming**
  (`player.js` `DIVE`): inside `world.deepAt` a swimmer dives where you look, Jump kicks (the distance is the exact integral, so 60
  and 20 fps match), bubble columns lift, the whirlpool sinks; outside `deepAt` nothing changed. Looks: underwater fog,
  `world.skyDim` per district, `world.underground = () => false` there. **Glowfish Catch:** hold Catch! to coil, let go to lunge;
  shy jar fish (bump a jar), darters (never caught in open water, only in the 7 dead ends), the breathing school. Fish go to their
  own district's lantern; 12 lights = `pw:atlantis:light1..12` (saved at once). With 12 the palace gate opens and Queen Coralia
  battles; a won battle clears the keys. No `WORLD_VERSION` change.
- **Race Track (T40c, spec `racer`; v2 owner 2026-10-27):** the race is the gate to Racer Rio (and his two Pit Crew); 3 laps,
  4 gates by segment crossing, Rio's position a closed form with a rubber band (`bossSpeed`; after lost races the kind help).
  **You drive a kart** (`kart.js`, a `carry` ride, 1/120 s sub-steps): the lap is a chain of pieces with heights (a jump ramp over
  the pond, the orange flyover, a tunnel); kerbs slow as much as grass. Calibrated: a clean drive wins by a few blocks, a wobbly one
  loses the first race and wins after one loss. Nothing saved or sent; the keep has `rideIn`. Wild Racers use `GAITS.dash`.
- **Ball type and the Ball Stadium (T40d, spec `ball`):** **the ball is local per player** (own meshes, never blocks, nothing sent,
  no `WORLD_VERSION` / duel `VERSION` change) and **never moves the player**; its clock is its own 1/120 s sub-steps, so 60 and
  1 fps give the same path. **Kick!** / **Shoot!** are held and let go (owner 2026-10-26 "a real skill": the power ring, no aim
  help; a jump shot with a good moment); keepers dive, Defender Dee and Blocker Bo get in the way (`live.rivals = false` in tests).
  The Captain needs **5 goals and 5 baskets** (owner 2026-10-27, was 3; keys `goal1..5` / `basket1..5`, the old 3 keys still
  count) and his crew Winger Wes and Hoops Hazel (`pw:stadium:crew1/2`, kept once beaten). `ui.setScore` chip. Owner 2026-10-26
  "a bit harder": beyond 9 blocks every other shot is aimed off the hole, Dee runs at the football once you touched it and kicks it
  out; Dee's speed and the green part shrink with every goal of the match.
- **Portal type and the Portal House (T42, spec `portal`, `tests/portalcheck.mjs`):** type `portal` (`gear: 'swirl'`, `GAITS.pop`),
  only in `REALMS.swirl.spawns.portal`. The House is **part of the Swirl world** (no frame, `PICTURE_WORLDS.portal` has
  `door: false`), reached by the Hub Swirl or `HOUSE_LIFT`. The Hall of Swirls and eight rooms, one idea each (owner 2026-10-27 rework:
  Gap, Fling, Clock, Skip Hall, Pair, Slider, Ball, Loop), then the Study (Grandpa Arch, a giant Gatestrider). **Rules
  (`portalplay.js`, one tap, no hold):** the Wand puts YOUR swirl on a white pad (peach pads take your orange one); speed in =
  `3.2 x sqrt(drop)`, flings on `PATHS.fling` checked every 0.02 s; the same pair 4 times in a row ends gently; falls are caught.
  Swirls are blue (yours), orange, green (room doors), pink, violet (ways back) (owner 2026-10-28). Progress `pw:portal:room1..8`
  (old four-room saves keep rooms 1-4); sparks, the Wand and your swirl are never saved. `portalcheck.mjs` proves each room needs its trick.
- **Funfair (T43, spec `funfair`):** type `funfair` (`gear: 'bulbs'`, ONE merged mesh). Playland's third zone. **Three skill games,
  a golden ticket each (`pw:fair:ticket1..3`), none is hold-and-let-go and none can be failed**; owner 2026-10-27 "harder games":
  three rounds each with surprises (*Bumper Cars*: pop the balloon on a bot's BACK; *Balloon Bounce* on the trampoline;
  *Gold Ring Ride* on the carousel). Three tickets open the **roller coaster** up to the **Star Stage** (no other way up) where
  **Merry Mae** battles; **Slide!** is the way down. Wild Funfair creatures only in the fair zone.
- **Surprise type and Jolly Jax's Surprise Party (T44, T48, spec `surprise`):** type `surprise` (`gear: 'bow'`; wild ones start
  wrapped: `gait: 'gift'`), only in `REALMS.doors.spawns`. **The realm `doors` is the Surprise Party** (owner 2026-10-28; it replaced
  T44's Room of Doors), **`version` 2** (the Room of Doors' blocks were all fixed, so dropping version 1 edits loses no build); the ids
  `doors` stay. The Party Spinner picks one of four games (Piñata Party, Jack Catch, Gift Stack, Pop-Up Whack), a golden bow each
  (`pw:doors:bow1..4`); three rounds, surprises in rounds 2-3. **Old saves:** the Room of Doors' bows are moved once keeping their
  number (`partyBows`, mark `pw:doors:party`); its keys `pw:doors:gift1..4` stay unread. Crashers Ribbon Rosa (after bow 1) and
  Confetti Kit (after bow 3) keep `pw:doors:crew1/2`. With four bows Jolly Jax bursts out of the cake. "Lights out!" uses
  `game.lightsDim`. Owner 2026-10-28: Play! puffs you onto the game's gold pad (`toStart`), a waiting game folds away when you are
  away 2.5 s, a big banner says each game's how-to once. No new block ids (236-243 reused). `tests/partybots.mjs` plays all four games.
- **Sketchbook look (T45, spec `doodle`):** the Sketchbook (`REALMS.doodle` version 1, `PICTURE_WORLDS` `doodle` = the old
  `secret1` place) is a pencil drawing. **Everything is behind switches that are off everywhere else** (the spec proves bit for bit
  that the main world, the Dream and the Swirl render the same, also after a trip there). `look.sketch` makes `World.sketch` true:
  `buildChunk` adds a `sketchEdge` attribute only then; the pencil shader code is compiled only with the material define `SKETCH`,
  which `game.sketch.reset` sets there and removes everywhere else. Look v2 (owner 2026-10-27: "a lot more sketch-based,
  hand-drawn"): paper faces, hand strokes on edges, hatching in world units, marks per block kind (a new kind = a `KIND` +
  `KIND_OF` entry and a `MARKS` painter). Models: `sketchModel(model)` after `buildModel` / `new Npc`; effects, the way-back door
  and all UI stay in colour (`userData.keepColour`).
  **Draw!** (owner 2026-10-27): the lines between pages are air in the world data; the child draws each bridge, the pencil draws
  **the way you face** (owner 2026-10-29, `FaceSteer`: only the look's yaw counts, never pitch or where the crosshair hits; it heads
  for the point `DRAW.ahead` 4 beyond it on the line you face along, turning at most `DRAW.turn` 2.5 rad/s; `faceChecks` in
  `doodlecheck.mjs` = walk straight, get a straight line; your sticky line slides your step along it, `alongLine`) and is drawn per player with `setLive` (`DO_INK`); never a fail (back to the last star); limited ink, blots,
  bees, wind and on lines 6-8 Rubber the Eraser (always slower than walking). Lines `pw:doodle:line1..8`; the gaps are keeps (no
  block bridges); landing on the blank page (`DO_PAPER`, y 4) for 0.5 s puffs you back. Artist Arlo's `gate` = all lines; a won battle clears lines 6-8. Owner 2026-10-28: the pencil glides along edges
  (`DRAW.glide`), needs only its centre free (`DRAW.core`) and never wedges (`doodlecheck.mjs` `wobblyKid`).
- **Knight type and the Castle (T49, spec `castle`, `tests/castlecheck.mjs`, `tests/castlebots.mjs`):** type `knight` (`gear:
  'pennant'`, `gait: 'sentry'`, condition `guardpost`; wool 254, block 182 `HEDGE`: the only new ids). `PICTURE_WORLDS` `castle` took
  the never-ready `secret3` place. **Shield Up!** (`siege.js`) on a Shield Stone: the stick points the shield, Jump = over your head;
  three rounds `pw:castle:shield1..3`; a splat is goo, never red (owner 2026-10-28). Round 3 lowers the drawbridge. The **hedge maze**
  is the only way to the Tilt Yard (the guide gives only words, a tip at 45 s, an arrow out at 90 s). **The Joust** (`joust.js`):
  steer the lance tip onto the star at the meeting time; `pw:castle:lance1..3`; round 3 raises the portcullis; owner 2026-10-28: the
  camera keeps Sir Splinter's shield in the middle and zooms, only the view changed (stick right = tip LEFT on screen, as before).
  **The gates are physical** (owner 2026-10-28): `castlegate.js`, the host owns them; your keys record only what you won. Sir
  Clanksalot gates on both challenges and Squire Pip and Archer Wren; a won battle clears the six round keys. Generic lines:
  `Player.look` asks `carry.look`, `setButtons({ jump })`, `ui.setPointers`, `game.rideShow`.
- **Cube Planets, STEP 0 ONLY (spec `cube`, `tests/cubecheck.mjs`, `plans/cube-planets.md` section 9):** the gravity sandbox, waiting
  for the owner to play it before steps 1-4 (games, crew, Boss, the Gravity type). Realm `gravity` (`PICTURE_WORLDS` `gravity` took the
  `secret5` place, its colours kept), in `LATER` (only `?preview`). Three cube planets (13, 9, 17 across) with a skin on all six faces
  and Planet Rock / cobble edges; hops are face to face across 4 blocks; the way back on the Meadow Cube's top; no wild creatures, no
  riding, no building (one keep `space` round the whole sky, with `rideText`). **The player** (`player.js`, only when the world has
  `gravityAt`; `frameUpdate` / `frameStep`): a frame (0-23); `pos` / `vel` stay in WORLD units for the rest of the game, each fixed
  1/120 s sub-step turns them into the frame exactly and runs the usual `moveAxis` / `collides` against `frameWorld`; yaw / pitch are
  your own on the face. Over an edge you turn round your feet and keep your local speed; into another planet's pull you turn round
  your middle and keep your world speed. In the air the stick only steers (`GRAV.air`). **The camera:** `p.viewQuat()` eases 0.45 s
  (0.8 s past 120 degrees); `main.js` premultiplies it (marked line); `eyePos` / `forward` / `lookAt` / `collides` follow the frame.
  Catch puff: 6 s outside every field. Save: `realmPos[5]` = the frame (`setFrame`; missing = upright).
  **Owner 2026-10-29 (played step 0):** keep the eased camera turn as the default; **steady camera** option: `p.steady` (main.js from
  `steadycam.js`) makes `turnView` a dip instead of a roll: the `#dip` overlay fades to the sky colour (`GRAV.dipOut` 0.12 s), the view
  snaps to the new up while hidden, then clears (`GRAV.dipIn` 0.18 s); `p.dipAmount()`. Toggles: the pause screen's `#steady-btn` (shown
  only in a world with `gravityAt`), **V**, and on tablets the Ride slot (says Steady there). **No riding** (realm def `noRide` = its
  words, generic): `riding.start` refuses, `riding.update` gets you off, `realms.enter` says it when you arrived riding. Before, a rider
  could get on because `frameWorld` had no fences (`fenced: () => false`); it now passes `fenced` / `fenceAt` through to the world.
  **Bevelled edges were tried and dropped:** with whole blocks a one-step bevel is a step DOWN seen from both faces, so at walking speed
  you fly over the 1-wide step, the down turns above it and you stand in the notch facing a 1-block wall (a jump at every edge); fixing it
  would need a new turn rule mirrored in `flightLand`. Off-world bit for bit:
  `tests/cuberecord.mjs` against `tests/fixtures/cube-off-golden.json` (made with the player.js of before).
- **Bubble type and the Bubble Well (spec `bubble`, `tests/bubblecheck.mjs`, `tests/bubblebots.mjs`, `plans/bubble-well.md`):** type
  `bubble` (`gear: 'film'`, `gait: 'float'`: wild ones float inside their own bubble, `Wild.reveal` pops it; condition `bubbly`); the
  only new ids are wool **255**, **147** `FOAM`, **148** `FIZZ_WALL`. `PICTURE_WORLDS` `bubble` took the `secret4` place; it is in `LATER`
  (closed without `?preview`). One climb up a round well (the whole map is a keep: no building, no riding). **Blow!** (one press, never
  held): a bubble 1.6 in front of the eyes (blown at the floor it sits on it), waits `BUBBLE.hang` 0.6 s, then rises; standing on it is a
  `carry` (Jump = Bounce, extra high); a fall from a bubble puts you back on your ledge. **Landing (owner 2026-10-29 "I could never jump
  on a bubble"):** `landsOn` = down through its top, or feet inside its top half (`scoop`; never the bubble you just left); one blown
  under your feet in the air catches you at once (`under`); the aim ring is green when a hop reaches it; the stick waits `settle` 0.5 s
  after landing. Spec part `real` plays with real keys and the game's own loop (the old robot climb drove the rules directly). The plateau overhangs the bench and a fizzy breeze (`BREEZES`, vents for bubbles) blows bubbles off the cliff, so the narrow
  shaft is the only way up (`bubblecheck.mjs` proves it). Keys `pw:bubble:stairs`, `duck1..3`, `chimney`, `shield1..3`; the two fizz
  lifts run once you did a stretch (or hold the star). Captain Suds (a giant Lathotter) gates on the five stretch keys and the three
  shields, then the crew Wanda Wand, Duckherd Daisy, Mate Fizz; a won battle clears the eight climb keys. Kind help only through
  `bubbleHelp` (= `kindHelp`); `HARD` is the rematch.

## Supabase

- Project **pokecraft**, ref `vsaawuqtjjhmclacbfxv`, org "Gondiken", region eu-west-1 (free plan).
  The owner's other projects ("bloomreach", "gondiken's Project") are unrelated; don't touch them.
- Table `public.saves (user_id uuid pk → auth.users, data jsonb, updated_at)` with RLS: each user
  can only read/write their own row. The URL and publishable key in `src/cloud.js` are public by
  design. Run the security advisor after any schema change.
- Auth: email + password with email confirmation. The owner has set Site URL / Redirect URLs to
  the GitHub Pages address.
- Realtime broadcast channels `pokecraft-world-<CODE>` carry play-together messages
  (`hello`, `world`, `state`, `block`, `bye`, `duel`); no database involved.
- Player battles (`duel.js`): both browsers use full-HP copies of both teams and a shared random
  seed (`battle.rng`), swap only each turn's choice, and work out the turn themselves. Anything that
  draws random numbers during a duel turn must do it in the same order on both sides.
- The Supabase MCP connector can run SQL. Deletes on `auth.users` timed out through it (probably
  a confirmation step); updates work.
- **Test accounts:** to test online saves without sending email, create a pre-confirmed user in
  SQL (insert into `auth.users` with `email_confirmed_at = now()` and a bcrypt password via
  `extensions.crypt(...)`, plus a matching `auth.identities` row with provider `email`), use an
  `@pokecraft.invalid` address, and remove or ban it afterwards. Never sign up fake addresses
  through the real API (bounced emails hurt the project's email sending).

## Testing

Browser tests live in `tests/` (Playwright + software WebGL):

```bash
cd tests && npm install && npm test        # all specs, quick ones first, each spec's time printed
node run.mjs gym touch                     # just some
node run.mjs --fast                        # only the quick group (roster, seventh, four-types, bone-alien, icon, blocks, map, kindhelp, jump)
node run.mjs --skip champion               # everything but some (a spec that hangs is stopped after 15-30 minutes)
PC_TEST_EMAIL=... PC_TEST_PASSWORD=... node run.mjs cloud   # real online-save test
```

Specs (`tests/specs/`; each file's header comment says more). "Two browsers" = `openPair`; screenshots go to `tests/screenshots/`.

- `access`: T16 golden guide replay (`tests/fixtures/guide-golden.json`), a test-only access kind, the guide has no kind checks
- `asks`: T39b one-button answers (fresh / held / too-quick presses, Esc / N / Backspace, lost mouse lock, iPad box)
- `atlantis`: T41 type, terrain (old sea hash-equal to a 224 world), swimming, each fish's trick, lights, gate, Queen, old v1 save, iPad, two browsers; `ATLANTIS_ONLY=node|data|terrain|swim|play|lights|old|ipad|pair|shots`
- `ball`: T40d `ballphysics.js` in Node (60 vs 1 fps) and the stadium; browser: goals, baskets, gate, saves, iPad, two browsers; `BALL_ONLY=node|browser`
- `battle-and-menu`: a wild battle with clicks, catching, menu, New Game / Continue
- `big-map`: T17/T32 old area identical, seams, start, slots, gym protection, treasure spots, a `[288, 288]` save
- `big-moves`: T25 data, the seven kinds, draw counts, AI, mirrored duel, buttons, gyms and rematches
- `blocks`: block types, biomes, creatures where they fit, the Blocks panel, the atlas grid
- `bone-alien`: Bone and Alien types
- `book`: Creature Book
- `box`: storage box (T13): let go, sort, filter
- `castle`: T49 type, terrain (`castlecheck.mjs`), Shield Up! and the Joust with `castlebots.mjs` at 60 / 20 fps, shared gates, play, iPad, two browsers, closed without `?preview`; `CASTLE_ONLY=data|land|rules|play|ipad|pair|closed|shots`
- `bubble`: the Bubble type, the well as terrain (`bubblecheck.mjs`), bubbles / ducklings / the Chimney Ride / the shields with `bubblebots.mjs` at 60 / 20 fps, the climb with the real Player, play, iPad, two browsers, real keys and taps through the game's own loop (`real`), closed without `?preview`; `BUBBLE_ONLY=data|land|rules|play|ipad|pair|real|closed|shots`
- `caves`: T3/T8 caves and cave gyms
- `champion`: tower, guards, coach, Champion (slow, about 5 min)
- `clock-tower`, `hidden-hill`, `firewall-maze`: the T19 gyms
- `cloud`: real online saves (skipped without `PC_TEST_EMAIL` / `PC_TEST_PASSWORD`)
- `comingsoon`: wave 15 ships closed; `?preview` opens the worlds (the other specs play with them open)
- `cube`: Cube Planets step 0: off (bit for bit elsewhere), the 24 frames, every edge of every planet at 60 / 20 fps, no flicker, corners, hops vs `flightLand`, the catch puff, the steady camera (no part-way roll, the dip), land (3 seeds), play (no riding, arriving on a creature, the Steady button kept after a reload, reload keeps the frame), iPad (the Steady slot, V), closed; `CUBE_ONLY=off|frames|gravity|land|play|closed|ipad|shots`
- `dance`: Echo Gym dance-off, rematch dance, old saves keep badge / trainer / wins
- `dojo`: T37b building for three seeds, `sneak.js`, spotted / puff / hiding / squeak, sneak attack, iPad; `DOJO_ONLY=shots|build`
- `doodle`: T45 type, pencil atlas, sketch switch off = bit for bit, the look, terrain, Draw! with model players at 60 / 20 fps, play, iPad, two browsers; `DOODLE_ONLY=data|atlas|off|look|land|trace|play|ipad|pair|shots`
- `dream`: T35 terrain (three seeds + 192 fallback), gravity, Bounce Blocks, the Upside-Down House gym, moon, morning, old edits dropped, iPad
- `food`: T33 Food type and the Restaurant
- `four-types`: T9 Sky / Slime / Light / Paper + Puzzlet; `T9_TYPE=sky|slime|light|paper`
- `funfair`: T43 type, layout in Node, game rules at 60 / 20 fps, play loop, iPad, two browsers; `FAIR_ONLY=data|land|games|play|ipad|pair|shots`
- `fx`: attack animations; `PC_FX_ALL=1` screenshots every type and signature move
- `gym`: gym flow, rematches, the Cozy Gym part
- `hide-seek`: T30 a full round with the role swap, iPad pair
- `home-ui`: T22 home UI on desktop (panel, meter, outline, example house); `HOME_TYPE`
- `homes`: T22 room rules, re-checks, Doormats, visitors, test-only type, save/load, two browsers
- `icon`: tab and home-screen icons
- `kindhelp`: the shared kind help in Node, every game's levers within `KIND_HELP.max`
- `jump`: the jump arc, falls, Springs, a Dream Bounce Block, trampolines and lifts at 20 / 30 / 60 / 120 fps against the old 60 fps numbers; a Jump tap shorter than one frame (key, iPad button) still jumps; a held Jump still hops
- `map`: old-save migration (the 192 map)
- `missions`: T29/T38c data, treasure spots, map / build / swap / rare blocks / catch / rematch, the pure maker, old saves at 12, iPad; `CATCH_TYPE`
- `missions-coop`: T29/T38c co-op giant on two browsers (same trace), growth, duel `VERSION` 11
- `moves`: T6 moves and the forget prompt
- `multiplayer`: play together on two browsers (incl. the Cozy part)
- `nav`: T39a "Where to go" on desktop, iPad, a friend row, the Dream
- `new-gyms`: T10 placement, the Cloud and Saucer climb, battles
- `new-gyms-access`: T14 night gyms, alien look, badge HUD
- `new-types`: Cosmic and Sound types
- `ninja`: T37a data, chart, models, the blink walk with real physics, a battle
- `old-saves`: gyms 17–22 and old saves (`SUM`, `SUM22`, `SURF`)
- `parkour`: T36 creatures, `high` condition, the run-away walk, the Obstacle Course
- `picture-worlds`: T40 base: types, blocks, stand-in terrains, the Mover, the whole loop, Boss rematches, two browsers, old saves, iPad; `PW_ONLY`
- `pirate`: T40b type, terrain for three seeds, gadgets with real physics at 60 / 20 fps, the challenges, play loop, iPad, two browsers; `PIRATE_ONLY=data|terrain|gadgets|challenge|play|ipad|pair|shots`
- `portal`: T42 type, the House as terrain (`portalcheck.mjs`), physics at 60 / 20 fps, play, iPad, two browsers; `PORTAL_ONLY=data|land|physics|play|ipad|pair|shots`
- `pvp`: duels between two browsers
- `racer`: T40c type, track maths, builder, the race, the dash gait, Book, iPad, two browsers; `RACER_ONLY=data|track|race|gait|book|ipad|pair`
- `realms`: T31/T35 realm seed, bed rules, there and back, morning, save/load, old saves, two browsers
- `realms-together`: T38b following the host, the host's edits, the guest's save untouched (helpers in `tests/realmhelp.mjs`)
- `riding`: T27 on/off, land / water / sky, fences, battles, touch, visitor
- `roster`: every type has 7 creatures, each findable, evolving into something real, with a model
- `seventh`: 7th creatures; `T4B_GROUP=A|B|C|W11|W12`
- `sound`: sound effects and the on/off button
- `spawn-rules`: T18 conditions, golden hour, Camo disguises, Cyber with two players
- `squad`: T34 crews, `weakensWithHp`, the Big Top Gym
- `surprise`: T44 + T48 type (chart vs `tests/fixtures/chart-before-t44.json`), gift boxes, party terrain, `partyBows`, the Spinner, the four games with `partybots.mjs` at 60 / 20 fps, live play, iPad, two browsers; `SURPRISE_ONLY=data|land|games|live|ipad|pair|shots`, `SURPRISE_SKIP_BOSS=1`
- `swirl`: T38a/d the Portal Door, stars, travel, Swirl terrain, lifts, frames, bridge, looks
- `three-types`: T18 Time / Camo / Cyber; `T18_TYPE=time|camo|cyber`
- `tiny`: T40a type, Giant House terrain (`housecheck.mjs`), live puzzles, Nibbles, iPad; `TINY_ONLY=type|land|live|ipad`, `TINY_SKIP_BOSS=1`
- `touch`: emulated iPad with real multi-touch
- `traits`: T26 data, drawing, evolution, old saves on two browsers, Book line, duels
- `treasure`: T20 treasure blocks, counts, save/load
- `treasure-vault`: T23 vault placement, keys, door, compass
- `two-types`: T21 Cozy and Treasure (chart incl. the unchanged old 26 x 26), `home:<type>` with fake homes; `T21_TYPE=cozy|treasure`
- `water`: T12 climbing out of water
- `weather`: each kind forced, particles, spawn mix, visitors get the host's weather

Other test tools: `tests/perf.mjs` (load, memory, draw calls, fps; `--swirl`, `--dream`), the
`*-preview.mjs` model photographers. Shared helpers are in `tests/helpers.mjs` (`openGame`, `openPair`, `seedSave`, `continueGame`,
`platform`, `startWeakBattle`, `waitFor`, `playBattle`): prefer `waitFor`/`waitForFunction` to fixed sleeps. Gotchas learned the hard way:
- If the pinned Playwright's browser is missing, point the helpers at another Chromium: `PC_CHROMIUM=/opt/pw-browsers/chromium node run.mjs ...`.
- Cloud sessions may block unpkg/jsdelivr and **WebSockets**. The helpers serve three.js from
  `tests/node_modules` and block Supabase unless a test opts in. The multiplayer spec relays
  messages between two browsers itself (`?mp=local` swaps Supabase Realtime for a
  BroadcastChannel), so the real Realtime connection is not covered by tests.
- After a game starts the page holds **pointer lock**, and every mouse click goes to the canvas.
  Pause with `document.exitPointerLock()` (like pressing Esc) before clicking any UI.
- Software rendering runs at ~1–2 fps, so timing-based logic must use event timestamps, and
  "tap" detection is movement-based (not duration-based) for that reason and for kids who press
  and hold.
- Teleporting the player in tests can put blocks between the camera and a target; pick clear spots.

## Open items

- **Next work is planned in `ROADMAP.md`** (waves, how to run them with subagents; read it before starting new features). Done:
  waves 1-12 (T1–T37: types, gyms, caves, homes, missions, realms, the 288 x 368 map, 32 gyms and the Tower), wave 13 (T38a-d: the
  Portal Door and the Swirl, realms together, missions that never end, the pastel Swirl), 13.5 (T39a-c), 14 (T40-T40d: Picture
  World base, Giant House, Pirate Seas, Race Track, Ball Stadium), 14.5 (the atlas grid), 15 (T41-T45 + T48: Atlantis, Portal House,
  Funfair, Surprise Party, Sketchbook; plans `wave15.md`, `T41`-`T45`) and T49 (the Castle). Next: wave 16 (Bubble Well and Cube
  Planets, `plans/bubble-well.md`, `plans/cube-planets.md`), then wave 17 (the Wizard's Tower and the Custom type); chapter 3 = the
  Scribble as the Wizard's ally (battling beside him, crafting, eggs and raising, gifts and trading); the backlog (maybe a Swirl
  place, S1–S2: shared maze lasers and shared wild creatures when playing together, host is the authority). The Portal Lab idea is
  `plans/T47-portal-lab.md` (not built).
- Two locked test accounts (`claude-test-a/b@pokecraft.invalid`) may still exist in Supabase;
  the owner was asked to delete them under Authentication → Users.
- The real Supabase Realtime path for play-together hasn't been exercised by automated tests
  (WebSockets blocked); the game logic around it has.
- Late gyms (levels 25–30) still need a fair amount of training; wild creatures top out lower until 16 badges (then +10 levels), and Coach Dex in the Champion's Tower gives double XP.
