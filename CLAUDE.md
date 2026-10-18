# PokeCraft: notes for Claude

A browser game (Minecraft-style voxel world + collectible creatures, gyms and badges) built for the
owner's son. Player-facing docs (features, controls, gym list, type chart) are in `README.md`;
this file is for working on the code.

## The people and their preferences

- The owner (parent) plays with their son, on desktop and **iPad/tablets**. Keep text short,
  friendly and readable by a child; error messages should say what to do next.
- **No Pokémon names or exact Pokémon terms.** All creatures, moves and gym names are original.
  Types that came from Pokémon were renamed: Poison → **Toxic**, Fairy → **Pixie**,
  Dragon → **Drake** (Psychic is **Mind**, Steel is **Metal**, and **Rainbow**, **Bone** and **Alien** are our own; 28 types in all: **Sky**, **Slime**, **Light**, **Paper**, **Time**, **Camo**, **Cyber**, **Cozy** and **Treasure** are our own too).
- Gym difficulty should stay on the easy side; the owner already asked once for easier gyms.
- **No Google sign-in.** It was tried and removed (needs Google Cloud console setup the owner
  didn't want). Email + password and "Forgot password?" are the sign-in options.
- Prefer free services. Deployed on GitHub Pages; backend is a free Supabase project.

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

| File | What it does |
| --- | --- |
| `src/main.js` | Glue: renderer, input, game loop, save/load, title + pause screens |
| `src/accounts.js` | `createAccounts(game, deps)`: sign-in box on the title screen, online save upload/download (moved out of `main.js` in T15) |
| `src/playtogether.js` | `createPlayTogether(game, deps)`: share/join box, visitor `loadWorld`, `goHome`, wires `Multiplayer` and `Duels` (T15) |
| `src/rematch.js` | T28 gym rematches: `rematchTeam(def, wins)` (pure), `loadWins`, `grownUp`, `rematchMoves` (T25 hook), `REMATCH`, `createRematch(game, { startBattle })` -> `game.rematch` (`offer`, `accept`, `won`, `lost`, `update`) |
| `src/hideseek.js` | T30 hide and seek: `HS` (times, radius), `createHideSeek(game)` -> `game.hideSeek` (`invite`, `onMessage`, `tick`, `tag`, `fence`, `blocksBattle`, `update`, `prompt`/`action`, `stop`, `left`, `reset`, `state`; getters `active`, `role`, `frozen`) |
| `src/guide.js` | `createGuide(game)`: guide arrow and "Welcome to the ..." / closed toasts; knows no gym kinds, only reads `game.access.of(gym)` (T15, T16) |
| `src/access.js` | Gym access objects (T16): `WHERE` (surface / cave / sky: arrow target + text, tips, welcome) x `WHEN` (always / night: wait, closed text) pieces, `createAccess` -> `game.access.of(gym)` (`aim`, `tips`, `contains`, `welcome`, `wait`, `closedText(npc)`); a gym picks pieces from how it was placed and `def.night`, or `def.access = { where, when }`. New gym kind = a `WHERE`/`WHEN` entry (+ `def.access`), never an `if` in the guide |
| `src/world.js` | (T17: `generate()` makes the old 224 map in its own `World(seed, …, [224, 224])` and copies it in, then `generateNewLand()`; `protectedAt`/`editAllowed`/`cull`) Seeded terrain, biomes (`biome(x, z)` from height + warmth/wetness noise), plants, ores, `generate()`, chunk meshing (solid / water / glowing), voxel raycast |
| `src/gymplace.js` | Gym and tower placement and buildings (`gymSpots`, `placeGyms`, `buildGym`, `pickSpot`, `placeTower`...): a class whose methods `installGymPlacement(World)` copies onto `World.prototype` (moved out of `world.js` in T15, code unchanged) |
| `src/homes.js` | T22 homes: `Home` (record `{ owner, name, x, y, z, type }` + `report` + `result`; `freeCells`/`spawnSpot`/`standSpots(n)`), `HomeManager` = `game.homes` (`reset`, `load(records, worldOwner)`, `toSave`, `mine`, `at`, `worldOwnerHome`, `ready`, `place`, `choose`, `apply`, `onEdit`, `update`, `stand`, `onChange`, `findRoom`; `matPos`/`onMat`/`active`/`chooseTarget()`) |
| `src/roomfinder.js` | `findRoom(world, x, f, z)`: the room around a Doormat (flood over the L3 cells, leak finder, ring, door runs, roof, floor, zones) -> plain report; knows no home type |
| `src/hometypes.js` | `HomeType` (`evaluate(report)`), features `hasBlock`/`atLeast`/`mostly`, `HOME_TYPES`, `addHomeType`/`removeHomeType`, `boxHouse`, the Cozy and Treasure types and their example houses, `placeExample` |
| `src/homeui.js` | `createHomeUi` -> `game.homeUi`: meter, red gaps and floor outline, home panel (choose / home / preview), spinning example |
| `src/caves.js` | Caves: `carveCaves(world)` (seeded worms below a 3-block roof, entrances, lakes, decoration, chests), `carveBigCaves(world)` (second layer: halls, wide tunnels, lit stairways, lamp posts), `planStairs`/`buildStairs` (also used by the cave gym) and the light shader (`caveLight`, `patchMaterial`) |
| `src/blocks.js` | Block ids (wool is 20–38, newer blocks 40+), `PLACEABLE` (Blocks panel), procedurally drawn texture atlas, per-type "wool" roof blocks; `limited` blocks (T20: `TREASURE`, `isLimited`) |
| `src/species.js` | Types + effectiveness chart, moves (134, with `fx`; `moveInfo(id)` gives the button/Book words), all 196 normal species (7 per type; the `roster` test checks this) plus the legendary Zenithar (`legendary: true`, never in `SPAWNS`, not catchable; the roster counts skip legendary species) (stats, learnsets, evolutions, model recipe), spawn tables, XP curve, blocky model builders + animation |
| `src/shapes.js` | Model-building helpers (`box`, `eyes`, `addWings`...) and the newer body shapes (star, robe, hopper, planet, comet, cloud, tall, squid, bat, drum, ape, bell, armadillo, wyvern, fish, nut, drone, wisp, puff, crystal, moth, butterfly; the T9 shapes kite, balloon, skywhale, pinwheel, gelcube, drip, slimedog, gummy, sunfox, lighthouse, rooster, mirrorball, paperplane, origamifrog, book, puzzle; the T18 shapes hourglass, pendulum, alarmclock, sunmoon, bushblock, sandcastle, stonecube, igloo, pixelblob, cursor, wifiwing, glitchghost; the T21 shapes blanketbun, mittencat, pillowsheep, pajamabear (Cozy), coin, crystalfox, gemring, chandelier (Treasure) and `sparkleGeometry`; the 7th-creature shapes plushie, candle, jelly, bonsai, bulbfly, geode, globe, snail, lantern, crane, windup, pitcher, teacup, nimbus, chameleon, blackhole, jukebox, fishbone, zorb) |
| `src/gyms.js` | The 27 gyms in difficulty order (teams, leader/trainer names, dialogue; `trainersOf(def)` / `trainerKey(def, i)`: old gyms have one `trainer`, T19 gyms a `trainers` list) and `TOWER` (the Champion's Tower: nurse, coach, two guards, champion) |
| `src/book.js` | Creature Book (key C, `game.book`): seen/caught sets, list + creature + move pages, spawn/evolution/type-matchup helpers; wiki links (T19.5): `go(view)`/`back()` trail, `open({ species, move, type, from: 'team' })`, `typeLink`; the team screen links in via `ui.openBook` / `ui.backToTeam` |
| `src/battle.js` | Turn-based battles (wild and trainer), catching, XP share, evolution |
| `src/creatures.js` | Wild creature spawning (biome tables + spawn conditions), wandering, Camo disguises (`spawnAt`, `Wild.reveal`) |
| `src/spawnrules.js` | Spawn conditions as data: day/night, dawn/dusk golden hour, together; `goldenHour`, `condOf`, `condOk`, `CONDITIONS` |
| `src/disguise.js` | `Disguise`: a creature or person drawn as a world block that blinks; used by Camo creatures (T19: Hidden Hill trainers) |
| `src/npc.js` | Blocky people (trainers, leaders, Healer Hana, other players' avatars); an Npc has `index` (which trainer of its gym) and `def` (its entry in the gym def) |
| `src/gymlive.js` | `createGymLive(game)` (`game.gymLive`): live gym parts for defs with `def.live` (`reset`, `update`, `stand`, `hit`, `prompt`, `of`) and `LiveCells` (a door/laser never turns solid inside the player); they change blocks only with `world.setLive` (T19) |
| `src/daytime.js` | The Clock Tower's door windows (`WINDOWS`, `windowAt(t)`, `minutesUntil`) by `game.time` (T19) |
| `src/clocktower.js`, `src/hiddenhill.js`, `src/firewall.js` | T19 slot gyms: `buildClockTower` / `buildHiddenHill` / `buildFirewallMaze(world, def, slot)` (+ `ClockLive`, `MazeLive`); registered in `SLOT_BUILDERS` (gymplace.js) |
| `src/homegym.js` | T23 Cozy Gym: `homeGymState(game, g)` (pure, used by `WHERE.home`/`WHEN.home`), `homeTypeFor`, `caughtOfType`, `HomeLive` (`LIVE.home`) |
| `src/treasurevault.js` | T23 Treasure Vault: `buildTreasureVault(world, def, slot)` (slot 4), `VaultLive` (`LIVE.vault`) |
| `src/ui.js` | HUD, team screen, creature portraits |
| `src/touch.js` | Tablet controls (joystick, drag-to-look, tap-to-interact, buttons) |
| `src/cloud.js` | Supabase: accounts, online saves, realtime channel |
| `src/multiplayer.js` | Play together: share code, avatars, block sync |
| `src/duel.js` | Player-vs-player battles over the play-together channel |
| `src/traits.js` | T26 traits (no imports): `TRAITS` (only `rideable`: text, book, caught, grown, chance 0.25, `species` map to `'land'`/`'water'`/`'sky'`), `hash32`, `traitRoll`, `canHave`, `drawTraits`, `cleanTraits`, `ensureTraits`, `fixTraits`, `gainTraits`, `hasTrait` |
| `src/riding.js` | T27 riding: `RIDE` (land / water / sky numbers), `rideKind(c)`, `rideSpecies(id)`, `fitRide(model)`, `createRiding(game, { scene, closePanel })` -> `game.riding` (`start`, `stop(reason)`, `toggle`, `update`, `sync`) |
| `src/weather.js` | Weather: shared phase (clear/rain/storm/rainbow), per-biome kind (snow, sandstorm, fog, stars), particles, rainbow arc, lightning, spawn boosts (`game.weather.set(kind)` / `skip()` / `info()` for tests) |
| `src/fx.js` | Battle effects (`game.fx`: `attack`/`impact`/`status`/`aura`/`clear`, `hold` freezes them for screenshots in tests). Time-based and closed form, shared textures, never touches `battle.rng`, budgets: 6 live effects, 300 points, 12 draw calls |
| `src/fxrecipes.js` | `TRAVEL` / `IMPACT` per type, `SIG` per signature move, `FX_COLORS`; a recipe is `(k, from, to, opts) => ({ dur, step(p) })` |
| `src/sound.js` | Quiet Web Audio sound effects (`sound.play(name)`), on/off in the pause screen |

Key ideas:
- **Spawn conditions (T18):** the third entry of a `SPAWNS` entry names a condition in `CONDITIONS` (`spawnrules.js`); conditions with
  `share` (dawn/dusk 0.4, together 1/15) take that share of spawn attempts when true, `max` caps how many are alive at once, and
  creatures leave when their condition stops being true (`condOk` in `CreatureManager.update`). `creatures.env` (set in `main.js`)
  gives the time and the other players' positions; `creatures.context()` builds what conditions look at. A new way to be found
  (T21: `home:<type>`) is one more `CONDITIONS` entry plus a field in `context()`. The golden hour is 1 minute around sunrise
  (04:30-07:30 on the HUD clock) and sunset (16:30-19:30); the sky turns orange around them and `ticktock` plays when one starts.
  The Book words each condition with `text` and shows one "Anywhere" row for Cyber creatures.
  **`home:<type>` (T21):** `CONDITIONS.home` has a function `share` (`HOME_SPAWN` in spawnrules.js: cozy 1/60, x1.5 in the evening, x2 when the
  home is `full`; treasure 1/1500), `max: 1`, a `place` (the creature appears at `home.spawnSpot()` instead of a random spot) and
  `text`/`toast` per type (`condText`/`condToast`). `creatures.context()` has `homes` (from `creatures.env.homes()`, only those within
  `HOME_RANGE` 32, also underground since T22) and `evening`. T22 sets `env.homes = () => game.homes.ready()` (finished `Home`s: `{ type, x, y, z, full, spawnSpot() }`). The Book shows one "Near a cozy home" row.
  **Sparkle:** Treasure models sparkle (`parts.sparkle`, built in `buildModel` for the whole type, animated in `animateModel`;
  `sparkleGeometry` in shapes.js).
  **Camo creatures** have `disguise: { blocks, size }` in `SPECIES`: `creatures.spawnAt(species, x, y, z)` dresses them as the most
  common of those blocks nearby (`Disguise.pick`, no spawn if there is none or no room: `Disguise.fits`), they never walk (`Wild.still`),
  blink about twice a minute, show the normal name tag and block outline when looked at, and start a battle when hit, tapped, or
  walked into (`creatures.onBump`); `Wild.reveal()` (called by `Battle.start`) pops them out. **Never call `disposeModel` on a
  disguised model without `disguise.dispose()` first** (it would free the shared world material; `CreatureManager.remove` does
  it right). A disguise never changes the world, is never saved or sent. Wool ids: time 54, camo 55, cyber 56, cozy 68, treasure 69; the next free
  block id is 73 (57-64 are the T19 gym blocks, 65-67 the T20 treasure blocks, 70-72 the T22 Doormat / Bed / Fireplace).
- **T9 types (Sky, Slime, Light, Paper):** their creatures live in `/* ==== T9 x ==== */` sections of `SPECIES` (species.js) and their shapes in `SHAPES_SKY/SLIME/LIGHT/PAPER` (shapes.js); spawns are in `SPAWN_SKY/SLIME/LIGHT/PAPER`. Origrane is Paper; Puzzlet is Mind's 7th. Their attack effects are in `fxrecipes.js` (T11). See `plans/T9.md`.
- **7th creatures (T4b):** each type's 7th creature is single-stage with its own shape; `SPAWNS` gets them from `SEVENTH_A/B/C` right after the table. The `seventh` spec checks them (`T4B_GROUP=A|B|C` for one group).
- **Hide and seek (T30, `src/hideseek.js`, spec `hide-seek`):** a game for exactly two players over the play-together `hs` event (in `EVENTS`; `mp.sendHs`, hook `hs`;
  messages `ask/yes/no/cancel/round/found/help/stop`, `HS.VERSION` 1). The inviter is the leader: it runs the clock and score and sends `round` on every phase change and every
  `HS.beat` s; times travel as ms left, never clock times. The invitee hides first; roles swap each round (`hide` 60 s dark screen + frozen seeker, `seek` 180 s with a hot/cold compass,
  `brk` 6 s). The seeker says `found` (tap/click via `game.hideSeek.tag(avatar)` in `interact`/`tapAt`, or bump). `fence(pos, before, vel)` after `p.update` is the play-area circle
  (radius 40) plus gym boxes (`world.fenced`). No battles (`blocksBattle` in `startBattle`; duels say busy) and no riding during a game. `Avatar.hiding` / `Avatar.tag` hide the hider's
  tag and lead from the seeker. A disguised Camo creature within 6 blocks of the hider sends `help`, so the compass says "???". `ui.ask({ hint })`; `ui.setSeekCompass/setHideSeek/setDark`.
  The pause-screen box redraws once a second so the buttons follow players walking closer. `mp.close` and the title screen call `hideSeek.reset()`. Nothing is saved, no world change.
- **Gym rematches (T28, `src/rematch.js`, spec `gym`):** the first badge battle is unchanged; once you hold the badge, `talkTo` on the leader calls
  `game.rematch.offer(npc)`, which shows the generic `ui.ask({ text, yes, no, onYes, onNo })` box (`#ask`, Y/N keys, talk again = yes, `askYes/askNo/closeAsk`, `ui.asking`;
  reusable) and only then starts the battle (`opts.rematch = { gym, wins }`, `xpBoost` 1.5). Team = `rematchTeam(def, wins)`: tier = wins + 1, every leader
  creature +3 levels per tier (cap `REMATCH_CAP` 55, shared with the Tower Champion), grown up via `evolve`, plus `floor(tier / 2)` extras (up to 6 in all) taken from the
  gym's trainers' species, then the gym's type, placed before the signature creature. `rematchMoves` is the hook for T25 moves; `opts.team` tuples may carry a third
  element (moves, `makeCreature(species, level, moves)`). Win: `rematchCubes(n)` = `min(8, 3 + n)` cubes. Save field `rematchWins` (`{ [gymId]: n }`, `loadWins` drops
  junk; old saves have none), per player like badges. The box closes after 20 s, 8 blocks away, or when the gym closes (night, chilly Cozy...).
- **Champion's Tower:** `world.tower` is built by `placeTower` right after `placeGyms` (own spot from `towerSpot`, at least
  23 blocks from every gym; it never moves gyms). Its people are NPCs with `kind: 'tower'` and a `role`
  (`guard1`, `guard2`, `coach`, `champion`; the nurse is a normal healer). Everyone refuses until all 27 badges (since T19 also old Champions, who only keep the title: `game.champion`; `TOWER.locked(n, champion)` words it kindly). `beaten` gains
  `tower:guard1` / `tower:guard2`; the save has an optional boolean `champion`. Boss battles pass `boss: true`
  (Zenithar hangs on once and powers up at half HP); the coach passes `xpBoost: 2`. After 16 badges (or the Champion title)
  `creatures.levelBonus` is 10 (wild creatures get +10 levels).
- `window.pokecraft` is the global `game` object (handy in tests and the console):
  `world`, `player`, `party`, `box`, `badges`, `beaten`, `cubes`, `battle`, `mp`, `npcs`, `creatures`, `weather`, `rematchWins`.
  Weather is not saved (restarts clear on load); the host sends its phase to visitors, who never run the timer.
- **Gyms 17+ (Fossil = Bone, Saucer = Alien):** the first 16 gyms come from `gymSpots(ORIGINAL_GYMS)`; gyms 17+ from
  `extraGymSpots()` (furthest dry spots, terrain only). **Never change either or call `gymSpots` with another count**
  (it would move every gym in old worlds); caves are filled within 18 blocks of the extra gyms before the plants
  (`fillCavesNear`), and `generate()` places the 16 gyms, the tower, then the extras so nothing old moves. `GYMS` is
  appended to, never reordered.
- **Caves** (`caves.js`) are carved in `World.generate()` right after the terrain loop and before the plants,
  from the seed only, and only below `ground - 3` (3-block roof), so the surface, gyms, tower and
  old saves' builds stay as they were; only the 6-8 entrance holes break the surface. Keep-out:
  map edges, shores, gyms/tower (18 blocks), the start. `world.ground` = natural height per column,
  `world.top` = highest sky-blocking block, `world.skyAt()` / `underground()` say how dark a place is.
  Use `generate({ caves: false })` in tests to compare. **Lighting is baked into vertex colours:**
  r = shade x sky light, g = shade x block light (lamps, crystals, glowcaps), b = shade; the
  patched solid/water materials mix them in the shader. Day/night brightness is `caveLight.uLit`
  (not `materials.solid.color` any more) and `caveLight.uLantern` is the player's own light. Cave
  creatures come from `SPAWNS.cave` (`wild.cave`); chests are `B.CHEST` -> `B.CHEST_OPEN` (+3 cubes).
- **Caves layer 2 and the cave gym (T8, `plans/T8.md`):** `carveBigCaves` runs right after `carveCaves` (which is never
  changed) and the two legacy `fillCavesNear` calls; own rand `mulberry32(seed ^ 0xb16ca7e)`, only ever adds air. Up to 8 halls
  (themes crystal / lake / glow / fossil, lamp posts inside), hall tunnels, wide tunnels, up to 6 lit stairways
  (stone-brick arch + 2 lamps at the mouth, 1 step per 2 blocks) and lamp posts beside the old entrances. It adds
  `caves.halls` (`{ x, z, rx, rz, theme, mouth, dir }`) and `caves.marks` (arch/lamp-post columns; the tests allow the
  surface to differ there). Keep-out = the v1 mask + both legacy extra spots (18) + the Fossil cavern (17).
  **`generate({ caves, bigCaves = caves, caveGyms = true })`** order: terrain, v1 caves, legacy fills, big caves,
  `carveGymRooms`, plants, gyms 1-16, tower, `placeExtraGyms` (skips `place: 'cave'`), `placeCaveGyms`; then `gyms` is sorted into
  `GYMS` order. A gym def with `place: 'cave'` (the Fossil Gym; T10 may add more) gets a spot from `caveGymSpots()`
  (terrain only, 17x17 building in a 25-wide round cavern at floor y = 2, stairway straight out of the door, `front` = the
  stairs direction), a cavern + stairs + arch + lamp ring (`carveGymRoom`), a building from `buildGym(..., { cave: true })`,
  and a bright box in `world.litRooms` (`skyAt`/`inLitRoom`). **Never change the cave-gym mask, candidate order or `fy`:**
  it would move the gym in existing worlds. If a map has no room (about 1 seed in 100, e.g. 122) the gym is built on its
  reserved surface spot (the old Fossil spot is still reserved by `extraGymSpots`, so the Saucer spot never moves).
  Later cave gyms clear the caves around them (`fillCavesNear`) instead of changing the carve mask. `gymAt(x, z, y)` only
  matches a cave gym at its own height; `game.guideTarget` / `game.updateGuide()` are for tests; the multiplayer `world`
  message carries `wv` (`WORLD_VERSION`, bump it when blocks change for the same seed).
- **Gyms 19-22 (T10, `plans/T10.md`): Sunbeam (light), Origami (paper), Goo (slime, the second cave gym), Cloud (sky).**
  Their spots come from `newGymSpots()` (cached, terrain only; `EXTRA_GYMS_END = 18`: gyms 17-18 keep `extraGymSpots()`,
  which loops only up to it). Cave defs after 18 first (`caveGymSpot(def, A, M)` with T8's `caveMasks()` plus earlier
  cave gyms ±26 and their stairs ±3; `null` = surface fallback with `def.spot`, e.g. seed 22, about 15% of maps), then
  `pickSpot` in `GYMS` order (stages from strict to relaxed: share of `def.spot.biomes` within 12 blocks, `minGround`,
  dry, distance ≥ 30/26 to every gym and the tower; ≥ 32 from cave gyms and 18 from their stairs). `place: 'sky'`
  (the Cloud Gym): any dry spot whose ground within 14 is ≤ 22, floor `fy = min(36, maxG + 12)`; a `B.CLOUD` island
  (r 10.5, lamps underneath) with the gym (`buildSkyGym`), a flat sky-wool **landing pad** on the ground at `d = 11..12`
  in front of the door plus a lamp post; build a pillar on the pad's inner middle block up to `fy - 1` and one jump
  lands on the island. Gym object: `sky: true`, `pad: [x, y, z]` (the pad block; stand at y + 1), `y = fy + 1`;
  `gymAt(x, z, y)` only matches it at `y >= g.y - 1`. `def.night` (Comet and Saucer Gyms: people only at night, per-gym `def.nightText` for the closed toast; the arrow skips them by day and names them) and `def.saucer` (only the Saucer Gym: the flying saucer) are handled in `npc.js`/`main.js` (the guide and the closed message go through `src/access.js`: new gym kinds = a `WHERE`/`WHEN` entry + `def.access`). A person def may have `look: 'alien'` (antennae, big eyes, no hair/hat) or `look: 'star'` (star hat), drawn by `buildPerson`.
- **The Saucer Gym floats (wave 6):** its def has `place: 'sky'`; `placeExtraGyms` builds it with `placeSkyGym(spot, 'saucer')`
  (metal saucer island, `buildSaucerGym`, green `WOOL.alien` pad, `gym.padColor`) at its unchanged `extraGymSpots()` x/z, so no
  other gym, cave or the tower moves. Floor from `saucerFloor()`: `min(35, maxG + 12)`; when capped (hills > 23 near it, about 1
  map in 4) the hills within 13 are cut to `fy - 5` (`world.ground` too) and plants within 16 cleared. Its ±18 box (all y) is
  in `world.newGymBoxes`, so `old-saves` `SUM22`/`SURF` were re-measured (old code with that box left out = new code).
  The sky hints in `updateGuide` follow the nearest unbeaten sky gym. `WORLD_VERSION` is 4.
  **`world.newGymBoxes`**: the only places T10 may change the world (surface gyms ±21 all y, the Goo cavern ±16 and its
  stairs ±6, the Cloud Gym ±16); everything outside is block-for-block the T8 world (`old-saves` `SUM22`).
  `generate()` adds: `fillNewGymCaves` (R 18) for surface spots after `carveBigCaves`, the Goo cavern in `carveGymRooms`
  (fills caves only within 10 so its cavern may open into the caves), `placeNewGyms()` after `placeCaveGyms`;
  `generate({ newGyms: false })` leaves them out (tests). Wool ids: sky 49, slime 50, light 51, paper 52 (not 20 + i),
  `B.CLOUD = 53` (placeable). Coach Dex has a 7th team. Never change the spot rules: it would move these gyms.
- **Bigger map (T17, `plans/T17.md`):** `WORLD_W/D` = 288, `OLD_W/D` = 224, `MID_X/Z` = 112 (the start, gym doors, fly-over). **The old 224 area is
  generated by `generateArea()` in its own `World(seed, null, null, [224, 224])` and copied in (`adoptOld`)**, so it is block for block the old
  world (the `big-map` spec compares them; `old-saves`/`caves`/`map` checksums never change). Never let anything that runs on the 288 world
  search the whole map for old content: `gymSpots`/`extraGymSpots`/`towerSpot`/`highGround`/`startColumn`/`findSpawn` are pinned to `OLD_*`/`MID_*`;
  the cave carvers and spot searches (`legacyOnly(world)`) throw on a non-224 world; use `world.W`/`world.D` (instance) for array strides.
  **New land** = x or z >= 224: terrain, plants (no trees within 2 of the seam) and no caves, written only by `generateNewLand()` (`guardOld`
  makes `set()` throw inside the old area). **`newLandSlots()`** = 5 gym spots in the new land (49x49 boxes, terrain only, never change the
  rules; `SLOT_R`/`SLOT_GAP`): slots 0-2 T19 (Time, Camo, Cyber), 3 T23 Cozy (spare), 4 T23 Treasure. A def with `slot` is placed by `placeSlotGyms()`
  (`def.build` names a builder in `SLOT_BUILDERS`, gymplace.js; a def without one is a plain surface gym); a slot gym changes blocks only inside its box.
  `newGymSpots()` skips defs with `slot`. `generate({ slotGyms: false })` leaves them out.
  **Gym protection:** every gym object and `world.tower` has `protect: [{x0,x1,y0,y1,z0,z1}]` (surface/tower ±7, cave ±13 up to fy+13, sky
  island ±10 from fy-3; the sky pad and pillar are outside). `world.editAllowed(x, y, z, id)` is the one rule (opening a chest is allowed): used by
  `breakBlock`/`placeBlock` (main.js, toasts), visitors' `block` messages and `applyEdits` (old saves lose edits inside gyms). A new gym builder
  must set `protect`. `World.cull` hides chunks past the fog (draw calls). `WORLD_VERSION` is 6 (T19).
- **Gyms 23-25 (T19, `plans/T19.md`): Clock Tower (time), Hidden Hill (camo), Firewall Maze (cyber), slots 0-2 of the new land.**
  Step 0 (shared parts): `GYMS` defs with `slot`, `build`, `live`, `access`, `welcome`, `leaderWhere` and **`trainers: [{ name, colors, team, intro?, opens?, disguise? }]`**
  (two per gym; the 22 old gyms keep `trainer` + `trainerTeam`: use `trainersOf(def)` / `trainerKey(def, i)`, the first trainer keeps the key
  `<id>:trainer`, the second is `<id>:trainer2`). A gym object may have `trainerPositions` (one per trainer) and `area` (a box that counts as
  "inside" for the welcome toast; `access.contains` uses it). **Slot builders** live in their own files and are registered in `SLOT_BUILDERS`
  (gymplace.js): `(world, def, slot) => gym object`, write only inside `slot.box`, set `protect`/`area`/`trainerPositions`; until a gym's real
  building exists its file is a stub calling `world.stubSlotGym(def, slot)` (plain gym + second trainer). `world.levelSite(rect, fy, box, pad)`
  levels and slopes the ground for a builder. **Live blocks:** `world.setLive(x, y, z, id)` redraws a block for this player only (never an
  edit, never saved or sent; `markDirty` is the shared dirty-marking); doors and lasers use it through `game.gymLive` / `LiveCells`
  (a door or laser never turns solid inside the player). New blocks 57-64 (`LASER_RED/BLUE/FRIEND`, `SWITCH_RED/BLUE`, `FRIEND_PAD`,
  `RESET_BUTTON`, `CLOCK_DOOR`): not placeable; `noLight` = glow material but lights nothing around it; `wallText` = the toast for breaking it
  (`breakBlock`). Access: `WHEN.clock` (door windows from `daytime.js`; never skipped by the arrow), `WHERE.hidden` (arrow stops 20 blocks away),
  an optional `status()` that the guide appends, `def.welcome`. **No T19 access piece may define `tips`** (the access golden fixture would
  change). Specs: `clock-tower`, `hidden-hill`, `firewall-maze` (added by the builders), `gym`/`big-map` cover the shared parts.
- **Hidden Hill (T19, `src/hiddenhill.js`, slot 1):** a radius-18, 12-high hill made of each column's own biome blocks (never lowers land), a 14x14 room
  inside (camo-wool roof), a 1-wide tunnel to a cut face and a leaf hedge + flower bush at d = 17 hiding it. The door faces away from the start,
  or the next side when the land in front of that side climbs more than 4 blocks (terrain only, so deterministic); a 5-wide ramp (1 block per block)
  joins the cut to the land. `protect[0]` is ONE box holding room and tunnel (big-map's "2 outside protect[0]" test needs that). Gym object extras:
  `door`, `bush`, `plants`. **Disguised people:** a trainer def with `disguise: 'stone'` is dressed by `NpcManager.disguiseAs` (a 1x2 `Disguise`, the person's
  meshes hidden); `NpcManager.reveal(npc)` (talk/hit/bump, `talkTo` toasts "That stone pillar was ..."), `undisguise(beaten)` (in `begin()` and after a
  visitor's world loads) and `onBump` (only fires while `playing()`: pointer locked). `NpcManager.clear()` disposes disguises before the models.
  Spec `hidden-hill` (screenshots `t19-hill-*.png`).
  **Firewall Maze (`src/firewall.js`):** 37x25 cyber-wool building (`buildFirewallMaze`, door towards the middle like the other gyms); `ROOMS` = three 11x9
  laser grids (legend in the file; `solveRoom` is the BFS the spec re-runs: fewest presses 1/2/3, no trap, friend lane solves with 0), `ROOM_AT`
  grid -> local (d, s), `mazeCol(gym, d, s)` local -> world; gym object `rooms[k] = { red, blue, friend, switches, pads, reset, box }`, `fy`.
  `MazeLive` (`def.live: 'maze'`): per-player phase per room (stepping on `SWITCH_RED` -> red off/blue on, `SWITCH_BLUE` back), reset button
  (`hit`/`prompt`), friend lane open while another player (`game.mp.others` positions) stands on a pad; everything via `LiveCells` (never turns on
  inside you) and `setLive`. Sound `laserflip`. **Exit door (T23.5):** `gym.exit` (3 cells at local `EXIT_AT` (-9, 18), built as wall) and `gym.server` (the server room box); `MazeLive.updateExit` opens it with `LiveCells` for a player with the badge or inside the server room (never a way in; walking back alone, rooms 2 and 3 are traps: `solveRoom(rows, { back: true, phase })`). No block of the world changed, so no `WORLD_VERSION` bump. `LiveCells` is in `src/livecells.js` (re-exported by `gymlive.js`): **gym files must import it from
  `livecells.js`**, because `gymlive.js` imports them (a cycle breaks `LIVE = { maze: MazeLive }`).
- **Homes (T22, `plans/T22.md`, spec `homes`):** blocks Doormat 70, Bed 71, Fireplace 72 (the fire flickers: `flickerFire(atlas, k)` from `main.js` `frame()`
  while `world.hasFire`; only that 16x16 tile is uploaded with `renderer.copyTextureToTexture`: `texture.needsUpdate` on the whole atlas cut the frame rate to a quarter), eight wool colours placeable as rugs. **Room finder** (`roomfinder.js`): everything is checked in columns around the mat at
  floor level f (L1-L3 = f+1..f+3); flood over columns whose L3 is open (max 20 wide), a leak finder plugs necks (up to 4) so a missing wall top or a
  doorway without lintel shows as ONE hole, the ring (8-neighbours) gives walls/holes/door runs (a door = 1-2 wide, 2 high, nearest run to the mat), roof =
  lowest solid in f+4..f+12, floor, size >= 8x8, zones `counts[floor|inside|wall|roof][id]`. **Types are data:** `HomeType.evaluate(report)` -> `{ room,
  ok, rule, features, done, need, show, finished, full }`; nothing else knows "cozy"/"treasure", a new type is `addHomeType(new HomeType({...}))` (+ a
  `home:<id>` entry in the `SPAWNS` tables). **Ownership** by `game.playerId` (random, saved, same on all devices); one home per owner and per mat; homes
  belong to the world and are saved in the world part of the save (`homes`; a visitor keeps his own world's list in `game.homeWorld.homes`). `World.set`
  calls `world.onEdit` (homes mark themselves dirty for edits inside their box, re-check at most every 0.25 s in `homes.update`; a broken Doormat removes
  its home, placing a second one turns your old mat into Planks). Play together: `home` message (`mp.sendHome(record)`), `world` parts carry `homes` +
  `owner`; `WORLD_VERSION` is 8. Visitors: `spawnPlaced` in `creatures.js` (surface and cave spawners), `wild.indoor` creatures walk with `caveGroundY(...,
  underOnly = false)` and are not removed for being above/below ground; underground homes count too. `HomeType.gymMovesIn`, `home.standSpots(2)`,
  `homes.worldOwnerHome()` and `onChange` are for T23.
- **Gyms 26-27 (T23 step 0, `plans/T23.md`): Cozy Gym and Treasure Vault.** `place: 'home'` gyms (the Cozy Gym) have no building:
  `placeSlotGyms` pushes `homeGym(def)` = `{ def, home: true, x/y/z: null, protect: [], leaderPos: null }` (tests filter `!g.home`; `gymAt` skips `x == null`;
  `newGymSpots` skips them). Their people are `Npc.away` (hidden, parked at y -64, not pickable, not updated) until `npcs.placeAt(npc, [x, y, z], heading)`;
  `npcs.sendAway(npc)` takes them away again. `WHERE.home`, `WHEN.home`, `WHEN.keys` are in `access.js` (no `tips`). `HomeType.gymMovesIn` names the gym id;
  `def.moveIn.caught` = cozy kinds in the Book. The Treasure Vault is slot 4 (`def.build: 'treasureVault'`, `def.keys`, `live: 'vault'`); slot 3 stays spare.
  Blocks `KEY_CHEST` 73 (glow, noLight) and `VAULT_DOOR` 74 (not placeable, `wallText`); next free block id is 75. Save field `keys` (`game.keys`, strings
  `'<gymId>:<key>'`, per player, `loadKeys` drops unknown ones). `breakBlock` calls `gymLive.hit` first (touch break button). `WORLD_VERSION` is 9.
  Tower: needs all 27 badges; guards 47-50, Champion 49-52 (Zenithar 52), rematch cap 55, Coach Dex up to level 50 (9th team).
- **Treasure Vault (T23, `src/treasurevault.js`, slot 4):** `buildTreasureVault` (13x13, 15 high, `fy = clamp(terrainHeight, WATER_LEVEL + 1, 24)`, door `d = 6` towards the middle,
  roof layer `fy + 14`) writes only inside the slot box (guarded `put`) and returns `door` (9 cells), `lights` (3, `fy + 4`), `keys: [{ id: 'dig', chest, mark, spot }, { id: 'build', chest },
  { id: 'explore', chest, mouth, side }]` (order = `def.keys`), `protect` = vault box + 1-cell boxes round the dig and explore chests (the X, the shaft and the tunnel stay open, the roof is
  protected: build a pillar at Cheb 7). **Dig:** first of `DIG_SPOTS` (d, s) whose 5x5 is dry and within +-6 of `fy` (else the first, water -> sand), a gold X (treasure wool, 9 on the
  diagonals), the chest `DIG_DEPTH` 10 below the middle, shaft cells below each column's own ground forced solid. **Explore:** mouth `(d 12, s 18 * side)` (`side` = away from the X),
  runs along -d to d -13 (steps down; a step-down cell is 3 high so it can be walked), 6 cells towards the middle, a 5x5x3 chamber with the chest; the tube rule turns every non-solid
  neighbour into stone (only below the sky for the first cells). Plants within the X area and along the tunnel are cleared. `VaultLive` (`LIVE.vault`) holds no state: everything is
  drawn from `game.keys` with `LiveCells`/`setLive` every 0.25 s (chest `KEY_CHEST` -> `CHEST_OPEN`, lights `COBBLE` -> treasure wool, door `VAULT_DOOR` -> `AIR` at 3 keys); `hit` opens a
  chest (push key, sound `keyfound`, `game.save()`), `prompt` words chest/door. **Key compass:** `ui.setKeyCompass(null | { period, found })` (`#key-compass` in `#topright`, CSS var
  `--glint`); `VaultLive.updateCompass` shows it within 40 blocks (Chebyshev) of the vault while a key is missing, `period = clamp(0.3 + dist / 12, 0.35, 3)` to the nearest missing chest;
  `gymLive.of('treasure').compass` = `{ shown, period }` for tests. Spec `treasure-vault` (screenshots `t23-*.png`; BFS walks for tunnel and roof, save/load of `keys` through fresh
  browsers, because a reload saves the old state on `beforeunload`).
- **Cozy Gym (T23, `src/homegym.js`, `HomeLive` = `LIVE.home`):** every 0.25 s it reads `homeGymState`. Only the world owner's browser moves the gym in
  (`owner && ready && caught >= need`): `homes.setGyms(home, ids)` writes `home.gyms` (record field, validated against `place: 'home'` defs in
  `homes.js`, kept when the Doormat moves or the type changes, gone with the record, sent as the normal `home` message), then a 2.5 s knock
  (`phase: 'knock'`, sound `knock`, people on the door cells) and a "moved into your cozy home" toast. Everybody places the people from the record on
  `home.standSpots(3)` (leader furthest from the door), again when the home's key (mat, floor, inside size) changes or a person's cell turns solid;
  no record = `sendAway`. While the home is not finished `closedText` says "Brr" (arms shiver) and "Ahh, cozy again" comes when it is back. A cozy
  home needs 3 of its 5 things, so a test makes it chilly by removing Bed + Fireplace + Lamp. **A live object must not have its own `stand`/`hit`/`prompt`
  methods unless it means the `gymLive` hooks** (`gymLive.stand` calls `o.stand` on every object). Spec: the `cozyGym` part of `gym.mjs` and the Cozy
  part of `multiplayer.mjs`.
- **Riding (T27, `plans/T27.md`, spec `riding`):** physics live in `Player` (`ride`, `fly`, `waterTop`, `floorBelow`, `dropToFloor`, `fenceHit`/`capped`/`landed`); `riding.js` has the rules, toasts and the model under the camera (first person, eye and hitbox unchanged). Riders are fenced out of every gym/tower `protect` box by `world.fenced` (so sky gyms keep their pillar climb). Sky cap = floor + 6 (`WORLD_H` is only 48, so the spec's slab is at y 40); the user's get-off in the air glides down, forced ones (`startBattle`, left the team) are instant. Not saved. Visitors get `state.ride` (a species id, checked by `rideSpecies`). Touch: `#btn-ride`, `#btn-down`, `setRide`.
- **Treasure blocks (T20, spec `treasure`):** Sunstone 65, Ruby 66, Sapphire 67 (`TREASURE`), `glow` + `noLight` (they glint in
  dark caves without lighting them). **Limited blocks:** a block def with `limited: true` is only placeable while
  `game.blockCounts[id] > 0` (`isLimited`): breaking one adds 1 (placed or natural), placing uses 1; the hotbar slot and the
  Blocks panel show `×n` and are greyed (`.empty`) at 0. Save field `blockCounts` (optional, `{ [id]: n }`; `loadCounts` drops
  unknown ids and bad numbers; old saves have none). More limited blocks later = one more `limited: true` def.
  **Placement:** `world.placeTreasure()` runs last in `generateArea` (old area) and after `placeSlotGyms` in `generate` (new
  land only); it only turns natural `STONE` at least 4 below `world.ground` into treasure: 1.5% of cave-wall stone (next to air),
  0.12% of stone 8+ down, never in a `protect` box, from the seed only. So the old area changed **on purpose** (only stone ->
  treasure; `old-saves` counts treasure as stone for `SUM22`, `SUM` uses `generate({ treasure: false })`). `WORLD_VERSION` is 7 (8 since T22).
  **Capture Cubes from blocks** (leaves, gold ore) only come from natural blocks: `breakBlock` checks `world.edits` (a placed
  block has an edit), so place-and-break can't farm cubes.
- Biomes only change surface blocks and plants; **terrain heights must stay the same** for old
  saves' builds to line up. Heights are low, so mountain/snow/peak use each map's own height
  percentiles (`highGround()`: ~6% / 2% / 3–5%). Wild creatures wander off after a while and
  day/night-only ones leave when the time changes, so the 16-creature cap never freezes the mix.
  `SPAWNS` has a table per biome (the `blocks` and `roster` specs check coverage and placement rules).
- The world is **deterministic from its seed**; a save stores the seed plus the list of player
  block edits (`world.edits`, index → block id). Gyms are generated, not saved, so changing
  `placeGyms`/`gymSpots` moves gyms in existing saves (`continueGame` moves the player to spawn
  if they would start inside a wall).
- **Traits (T26, spec `traits`):** every creature has `traits: string[]` (often `[]`), set once in `makeCreature` from its `uid` (`drawTraits`: hash of `uid|trait` below `chance`, no extra `Math.random`) and saved, so a later change of the list or chance never takes one away. Old saves: `continueGame` runs `fixTraits` on party and box (missing `uid` -> `'o' + hash32('where:index:species:level')`, missing `traits` drawn from the uid, a saved list is cleaned, a saved `[]` stays) and saves if anything changed, so every device gets the same result. Evolution only adds (`gainTraits`, message `grown`). Traits do nothing by themselves; features read them (T27 riding reads `rideable`, `TRAITS.rideable.species[id]` is `'land'`/`'water'`/`'sky'`). Shown as a `.trait` badge on team/box cards (`monCard`), a `.book-trait` line on caught species pages and a toast after catching one. Duels send `traits` in the team and clean them on receipt (`teamIn`); no duel `VERSION` bump. Rideable species (35, 1 in 4): land blazehound, pyrolynx, grovebeast, thornox, thunderwolf, cragtusk, woolumph, blizzbear, hornbeetle, visionelk, titanox, lunaroo, howlbone, stompasaur, slimehound, solvixen, topiphant, dozeram, prismfox; water tidalord, torrentide, shellby, spectrafin; sky scalewing, stormwyvern, skywyrm, whaloft, zeppeluff, kitegale, auroraptor, sageowl, boomwing, jetfold, ufomax, duskmare.
- Save format: localStorage key `pokecraft-save-v2` (v1 saves are migrated: team kept, new world). Creatures have an optional `traits` list and a `uid` (T26).
  Edits are indexed by map size, so saves record `size: [W, D]`; `convertEdits` moves edits from
  saves made with another size (no `size` = the old 192×192 map). The map is 288×288 (old area 224×224, see T17 below).
  The same object is upserted to Supabase when signed in; whichever has the newer `savedAt` wins.
- Adding a creature: add to `SPECIES` (use `learn: L(type, secondType)` for a standard learnset: own-type moves plus a second type's) and to a biome in
  `SPAWNS`; the model is built from `shape` (the six in species.js or one in `SHAPES` in shapes.js)
  plus `extras`. **The owner wants creatures to look unique:** a new family should get its own body
  shape (write a new builder in shapes.js), not a recolour of another type's creature. Evolutions
  may share their family's shape. The `roster` spec requires at least 3 shapes per type. Adding a type: `TYPE_COLORS`, `EFFECTIVENESS`, two moves + `T1`/`T2`, a wool colour in
  `blocks.js` if it gets a gym. Also add `TRAVEL` / `IMPACT` / `FX_COLORS` entries in `fxrecipes.js` and an `fx:<type>` sound in `sound.js` (the `fx` spec checks both). A new signature move needs a `SIG` entry. Remember the README tables.
- Saves also have `seen` / `caught` (species id lists for the Creature Book). `Battle.refresh()` marks seen, a catch marks caught, and `snapshot()`/`Book.open()` call `book.syncTeam()` (team + box = caught), which covers evolution and old saves.
- Moves (`MOVES` in species.js): `fx.kind` is heal / raise / lower / flinch / sleep / multi / recoil; `sure`, `priority`,
  `sig` are flags. T24: multi-hit moves hit 1-5 times (`HITS_1_5` weights, `multiHits(fx, r)` from one draw; Thousand Cranes 3-5 uniform); sleep = `mods.sleep` turns left (2 or 3) + `mods.justWoke` (one free turn), a sleeper takes x1.25 (`takenFactor`), a multi-hit 3rd hit wakes it (`wakeUp`, `fallAsleep`, `catchChance` in battle.js), `moveInfo(id)` also returns `note`; duel `VERSION` is 8. **T25 big moves** (`plans/T25.md`, `plans/T25-table.md`): 61 moves in 7 kinds (`rally`, `shield`, `risky`, `sacrifice`, `curse`, `field`, `lastword`), each `fx: { kind, ... }` + `big: true` (`isBig`), made from `BIG_MOVES` in species.js; every creature of a type learns its type's moves at `BIG_LEVEL` (shield 21, rally 22, curse 24, field 26, risky 29, sacrifice 32, lastword 34) through `BIG` in `L()`. They use `odds`, never `chance`, and have no `sig`. Wild creatures and trainers never get them from `autoMoves(species, level)`; gym leaders get named ones through `movesWith(species, level, ...ids)`; `rematchMoves` in rematch.js adds one at tier >= 3. Battle: `battle.sides[side]` = `{ atk, spd, shield, gift }` (team state; `atk`/`spd` seed a new `mods()` entry so bench creatures pick them up on arrival), `battle.field`, `battle.round` (`tickEffects` at the top of `turn()`, no draws), `cantUse(side, id)` (lastword below 1/4 HP, sacrifice needs a bench), `mods.rest` (the shield user rests), `backfire` (risky), `giftArrives(side)`. Draw order gains 7 (risky coin, right after the damage roll) and 8 (curse roll). Duel `VERSION` stays 8 (T24 and T25 ship together). fx: `STATUS` kinds `rally`, `shield`, `curse` (`from` = user), `field` (`from` = other side), `sacrifice`; sounds `kind:rally|shield|jackpot|oops|gift|curse|field|lastword`. Spec `big-moves`. Ids are saved, names are display only. Per-battle stat steps and sleep live in `battle.modMap`
  (never saved, cleared when a creature comes in). `c.learned` lists moves already offered; `gainXp(c, xp, { ask: true })`
  returns `{ learn }` messages for `Battle.askForget` (full move list), and also offers one older move per level-up
  (old saves: `OLD_MOVE_IDS` count as offered). Duel draw order in `useMove`: hit, number of hits (multi), crit, damage
  roll, effect chance (moves with `chance`), sleep length (6th, whenever a sleep effect lands); nothing may branch on `side` before a draw. `duel.js` `VERSION` must be
  bumped when battle rules change. Never name a move like a sound effect in `sound.js` (`useMove` plays `sound.play(moveId)`).
- Pointer lock: with a mouse the browser only lets the game capture the mouse after a click.
  That's why battles end with a "Continue exploring" button and the pause screen exists.

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
node run.mjs --fast                        # only the quick group (roster, seventh, four-types, bone-alien, icon, blocks, map)
node run.mjs --skip champion               # everything but some (a spec that hangs is stopped after 15-30 minutes)
PC_TEST_EMAIL=... PC_TEST_PASSWORD=... node run.mjs cloud   # real online-save test
```

Specs: `big-moves` (T25: data, the seven kinds, draw counts, AI, mirrored duel, buttons, gyms and rematches), `riding` (T27: getting on/off, land/water/sky, gym fences, battles, touch, visitor), `traits` (T26: data, drawing, evolution, old saves on two browsers, badge, Book line, catch toast, duels), `homes` (T22 logic: room rules, re-checks, Doormats, visitors, test-only type, save/load, two browsers), `two-types` (T21: Cozy and Treasure data, chart incl. the unchanged old 26 x 26 chart, models, sparkle, the `home:<type>` condition with fake homes; `T21_TYPE=cozy|treasure` runs one), `treasure` (T20: treasure in the world, mining/placing counts, greyed at 0, save/load, placed gold gives no cubes), `spawn-rules` (T18: conditions, golden hour, Camo disguises, Cyber with two players), `three-types` (T18 species, moves, chart, models), `access` (T16: golden guide replay in `tests/fixtures/guide-golden.json`, a test-only access kind, guide has no kind checks), `caves` (T3/T8 caves and cave gyms), `moves` (T6 moves and the forget prompt), `seventh` (7th creatures), `bone-alien`, `new-gyms-access` (T14 night gyms, alien look), `water` (T12), `box` (storage box: let go, sort, filter; T13), `water` (climbing out of water; T12), `old-saves` (gyms 17–22 and old saves), `new-gyms` (T10 placement, the Cloud and Saucer Gyms' climb, the four new gyms' battles), `book` (Creature Book), `champion` (tower, guards, coach, champion battle; slow, about 5 min), `battle-and-menu`, `fx` (attack animations; `PC_FX_ALL=1` saves a screenshot of every type and signature move), `big-map` (T17: old area identical, seam, start, slots, gym protection), `gym`, `touch` (emulated iPad with real multi-touch), `multiplayer`
and `pvp` (two browsers, via `openPair`), `new-types`, `weather`, `roster`, `four-types` (Sky/Slime/Light/Paper + Puzzlet; `T9_TYPE=sky|slime|light|paper` runs one), `map` (old-save migration), `blocks`, `sound`, `icon`, `cloud` (skipped without credentials). Shared helpers are in `tests/helpers.mjs` (`openGame`, `openPair`, `seedSave`, `continueGame`, `platform`, `startWeakBattle`, `waitFor`, `playBattle`): prefer `waitFor`/`waitForFunction` to fixed sleeps. Gotchas learned the hard way:
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

- **Next work is planned in `ROADMAP.md`** (tasks T1–T7 in waves, how to run them with subagents,
  and the backlog). All waves (T1–T11), wave 7.5 (T19.5: Book wiki links) and wave 6a (T12–T14: bug fixes, storage box, night gyms) are done; T15 (cleanup) and wave 7 (T16–T19: guide cleanup, bigger map, Time/Camo/Cyber types and gyms) are done; wave 8 (T20–T23: treasure blocks, Cozy/Treasure types, homes, Cozy Gym and Treasure Vault) is done; wave 8.5 (T23.5: the Firewall Maze exit door) is done; next is wave 9 (T24-T30: multi-hit 1-5 and better sleep, team-effect moves with a price, traits (only Rideable for now), riding, harder gym rematches, Champion missions, hide and seek), then wave 10 (T31-T32: realms, room for more gyms), wave 11 (T33-T36: Food, Swarm, Dream, Parkour types), a Doodle wave (undecided), then the backlog (which now holds the backlog wave S1–S2: shared maze lasers and shared wild creatures when playing together, host is the authority). Read it before
  starting new features.

- Two locked test accounts (`claude-test-a/b@pokecraft.invalid`) may still exist in Supabase;
  the owner was asked to delete them under Authentication → Users.
- The real Supabase Realtime path for play-together hasn't been exercised by automated tests
  (WebSockets blocked); the game logic around it has.
- Late gyms (levels 25–30) still need a fair amount of training; wild creatures top out lower until 16 badges (then +10 levels), and Coach Dex in the Champion's Tower gives double XP.
