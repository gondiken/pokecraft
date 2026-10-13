# PokeCraft: notes for Claude

A browser game (Minecraft-style voxel world + collectible creatures, gyms and badges) built for the
owner's son. Player-facing docs (features, controls, gym list, type chart) are in `README.md`;
this file is for working on the code.

## The people and their preferences

- The owner (parent) plays with their son, on desktop and **iPad/tablets**. Keep text short,
  friendly and readable by a child; error messages should say what to do next.
- **No Pokémon names or exact Pokémon terms.** All creatures, moves and gym names are original.
  Types that came from Pokémon were renamed: Poison → **Toxic**, Fairy → **Pixie**,
  Dragon → **Drake** (Psychic is **Mind**, Steel is **Metal**, and **Rainbow**, **Bone** and **Alien** are our own; 23 types in all: **Sky**, **Slime**, **Light** and **Paper** are our own too).
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
  ~1–2 minutes after a push to the branch Pages is set to (being moved from
  `claude/clever-ritchie-etj0nq` to `main`; both are identical, so either works).

## Code map

| File | What it does |
| --- | --- |
| `src/main.js` | Glue: renderer, input, game loop, save/load, title + pause screens, accounts UI, play-together UI |
| `src/world.js` | Seeded terrain, biomes (`biome(x, z)` from height + warmth/wetness noise), plants, ores, gym buildings (`placeGyms`/`buildGym`), chunk meshing (solid / water / glowing), voxel raycast |
| `src/caves.js` | Caves: `carveCaves(world)` (seeded worms below a 3-block roof, entrances, lakes, decoration, chests), `carveBigCaves(world)` (second layer: halls, wide tunnels, lit stairways, lamp posts), `planStairs`/`buildStairs` (also used by the cave gym) and the light shader (`caveLight`, `patchMaterial`) |
| `src/blocks.js` | Block ids (wool is 20–38, newer blocks 40+), `PLACEABLE` (Blocks panel), procedurally drawn texture atlas, per-type "wool" roof blocks |
| `src/species.js` | Types + effectiveness chart, moves (107, with `fx`; `moveInfo(id)` gives the button/Book words), all 161 normal species (7 per type; the `roster` test checks this) plus the legendary Zenithar (`legendary: true`, never in `SPAWNS`, not catchable; the roster counts skip legendary species) (stats, learnsets, evolutions, model recipe), spawn tables, XP curve, blocky model builders + animation |
| `src/shapes.js` | Model-building helpers (`box`, `eyes`, `addWings`...) and the newer body shapes (star, robe, hopper, planet, comet, cloud, tall, squid, bat, drum, ape, bell, armadillo, wyvern, fish, nut, drone, wisp, puff, crystal, moth, butterfly; the T9 shapes kite, balloon, skywhale, pinwheel, gelcube, drip, slimedog, gummy, sunfox, lighthouse, rooster, mirrorball, paperplane, origamifrog, book, puzzle; the 7th-creature shapes plushie, candle, jelly, bonsai, bulbfly, geode, globe, snail, lantern, crane, windup, pitcher, teacup, nimbus, chameleon, blackhole, jukebox, fishbone, zorb) |
| `src/gyms.js` | The 18 gyms in difficulty order (teams, leader/trainer names, dialogue) and `TOWER` (the Champion's Tower: nurse, coach, two guards, champion) |
| `src/book.js` | Creature Book (key C, `game.book`): seen/caught sets, list + detail pages, spawn/evolution/type-matchup helpers |
| `src/battle.js` | Turn-based battles (wild and trainer), catching, XP share, evolution |
| `src/creatures.js` | Wild creature spawning (biome + day/night tables) and wandering |
| `src/npc.js` | Blocky people (trainers, leaders, Healer Hana, other players' avatars) |
| `src/ui.js` | HUD, team screen, creature portraits |
| `src/touch.js` | Tablet controls (joystick, drag-to-look, tap-to-interact, buttons) |
| `src/cloud.js` | Supabase: accounts, online saves, realtime channel |
| `src/multiplayer.js` | Play together: share code, avatars, block sync |
| `src/duel.js` | Player-vs-player battles over the play-together channel |
| `src/weather.js` | Weather: shared phase (clear/rain/storm/rainbow), per-biome kind (snow, sandstorm, fog, stars), particles, rainbow arc, lightning, spawn boosts (`game.weather.set(kind)` / `skip()` / `info()` for tests) |
| `src/fx.js` | Battle effects (`game.fx`: `attack`/`impact`/`status`/`aura`/`clear`, `hold` freezes them for screenshots in tests). Time-based and closed form, shared textures, never touches `battle.rng`, budgets: 6 live effects, 300 points, 12 draw calls |
| `src/fxrecipes.js` | `TRAVEL` / `IMPACT` per type, `SIG` per signature move, `FX_COLORS`; a recipe is `(k, from, to, opts) => ({ dur, step(p) })` |
| `src/sound.js` | Quiet Web Audio sound effects (`sound.play(name)`), on/off in the pause screen |

Key ideas:
- **T9 types (Sky, Slime, Light, Paper):** their creatures live in `/* ==== T9 x ==== */` sections of `SPECIES` (species.js) and their shapes in `SHAPES_SKY/SLIME/LIGHT/PAPER` (shapes.js); spawns are in `SPAWN_SKY/SLIME/LIGHT/PAPER`. Origrane is Paper; Puzzlet is Mind's 7th. Their attack effects in `fxrecipes.js` (and `fx:` sounds) are simple fallbacks until T11. See `plans/T9.md`.
- **7th creatures (T4b):** each type's 7th creature is single-stage with its own shape; `SPAWNS` gets them from `SEVENTH_A/B/C` right after the table. The `seventh` spec checks them (`T4B_GROUP=A|B|C` for one group).
- **Champion's Tower:** `world.tower` is built by `placeTower` right after `placeGyms` (own spot from `towerSpot`, at least
  23 blocks from every gym; it never moves gyms). Its people are NPCs with `kind: 'tower'` and a `role`
  (`guard1`, `guard2`, `coach`, `champion`; the nurse is a normal healer). Everyone refuses until all 18 badges (old Champions keep access: `game.champion`). `beaten` gains
  `tower:guard1` / `tower:guard2`; the save has an optional boolean `champion`. Boss battles pass `boss: true`
  (Zenithar hangs on once and powers up at half HP); the coach passes `xpBoost: 2`. After 16 badges (or the Champion title)
  `creatures.levelBonus` is 10 (wild creatures get +10 levels).
- `window.pokecraft` is the global `game` object (handy in tests and the console):
  `world`, `player`, `party`, `box`, `badges`, `beaten`, `cubes`, `battle`, `mp`, `npcs`, `creatures`, `weather`.
  Weather is not saved (restarts clear on load); the host sends its phase to visitors, who never run the timer.
- **Gyms 17+ (Fossil = Bone, Saucer = Alien):** the first 16 gyms come from `gymSpots(ORIGINAL_GYMS)`; gyms 17+ from
  `extraGymSpots()` (furthest dry spots, terrain only). **Never change either or call `gymSpots` with another count**
  (it would move every gym in old worlds); caves are filled within 18 blocks of the extra gyms before the plants
  (`fillCavesNear`), and `generate()` places the 16 gyms, the tower, then the extras so nothing old moves. `GYMS` is
  appended to, never reordered. Next up: T4b adds a 7th creature to every type (see `ROADMAP.md`).
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
- Biomes only change surface blocks and plants; **terrain heights must stay the same** for old
  saves' builds to line up. Heights are low, so mountain/snow/peak use each map's own height
  percentiles (`highGround()`: ~6% / 2% / 3–5%). Wild creatures wander off after a while and
  day/night-only ones leave when the time changes, so the 16-creature cap never freezes the mix.
  `SPAWNS` has a table per biome (the `blocks` and `roster` specs check coverage and placement rules).
- The world is **deterministic from its seed**; a save stores the seed plus the list of player
  block edits (`world.edits`, index → block id). Gyms are generated, not saved, so changing
  `placeGyms`/`gymSpots` moves gyms in existing saves (`continueGame` moves the player to spawn
  if they would start inside a wall).
- Save format: localStorage key `pokecraft-save-v2` (v1 saves are migrated: team kept, new world).
  Edits are indexed by map size, so saves record `size: [W, D]`; `convertEdits` moves edits from
  saves made with another size (no `size` = the old 192×192 map). The map is 224×224.
  The same object is upserted to Supabase when signed in; whichever has the newer `savedAt` wins.
- Adding a creature: add to `SPECIES` (use `learn: L(type, secondType)` for a standard learnset: own-type moves plus a second type's) and to a biome in
  `SPAWNS`; the model is built from `shape` (the six in species.js or one in `SHAPES` in shapes.js)
  plus `extras`. **The owner wants creatures to look unique:** a new family should get its own body
  shape (write a new builder in shapes.js), not a recolour of another type's creature. Evolutions
  may share their family's shape. The `roster` spec requires at least 3 shapes per type. Adding a type: `TYPE_COLORS`, `EFFECTIVENESS`, two moves + `T1`/`T2`, a wool colour in
  `blocks.js` if it gets a gym. Also add `TRAVEL` / `IMPACT` / `FX_COLORS` entries in `fxrecipes.js` and an `fx:<type>` sound in `sound.js` (the `fx` spec checks both). A new signature move needs a `SIG` entry. Remember the README tables.
- Saves also have `seen` / `caught` (species id lists for the Creature Book). `Battle.refresh()` marks seen, a catch marks caught, and `snapshot()`/`Book.open()` call `book.syncTeam()` (team + box = caught), which covers evolution and old saves.
- Moves (`MOVES` in species.js): `fx.kind` is heal / raise / lower / flinch / sleep / multi / recoil; `sure`, `priority`,
  `sig` are flags. Ids are saved, names are display only. Per-battle stat steps and sleep live in `battle.modMap`
  (never saved, cleared when a creature comes in). `c.learned` lists moves already offered; `gainXp(c, xp, { ask: true })`
  returns `{ learn }` messages for `Battle.askForget` (full move list), and also offers one older move per level-up
  (old saves: `OLD_MOVE_IDS` count as offered). Duel draw order in `useMove`: hit, number of hits (multi), crit, damage
  roll, effect chance (moves with `chance`); nothing may branch on `side` before a draw. `duel.js` `VERSION` must be
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
cd tests && npm install && npm test        # all specs
node run.mjs gym touch                     # just some
PC_TEST_EMAIL=... PC_TEST_PASSWORD=... node run.mjs cloud   # real online-save test
```

Specs: `old-saves` (gyms 17–18 and old saves), `book` (Creature Book), `champion` (tower, guards, coach, champion battle; slow, about 5 min), `battle-and-menu`, `fx` (attack animations; `PC_FX_ALL=1` saves a screenshot of every type and signature move), `gym`, `touch` (emulated iPad with real multi-touch), `multiplayer`
and `pvp` (two browsers, via `openPair`), `new-types`, `weather`, `roster`, `four-types` (Sky/Slime/Light/Paper + Puzzlet; `T9_TYPE=sky|slime|light|paper` runs one), `map` (old-save migration), `blocks`, `sound`, `icon`, `cloud` (skipped without credentials). Gotchas learned the hard way:
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

- **Next work is planned in `ROADMAP.md`** (T4a, the Bone and Alien types and gyms, is done; T4b is the 7th creature per type) (tasks T1–T7 in waves, how to run them with subagents,
  and the backlog). Waves 1–2 (T1, T2, T3, T5, T6) and T4a are done; T4b (7th creatures) is in progress, then T7. Read it before
  starting new features.

- Two locked test accounts (`claude-test-a/b@pokecraft.invalid`) may still exist in Supabase;
  the owner was asked to delete them under Authentication → Users.
- The real Supabase Realtime path for play-together hasn't been exercised by automated tests
  (WebSockets blocked); the game logic around it has.
- Late gyms (levels 25–30) still need a fair amount of training; wild creatures top out lower until 16 badges (then +10 levels), and Coach Dex in the Champion's Tower gives double XP.
