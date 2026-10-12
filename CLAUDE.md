# PokeCraft: notes for Claude

A browser game (Minecraft-style voxel world + collectible creatures, gyms and badges) built for the
owner's son. Player-facing docs (features, controls, gym list, type chart) are in `README.md`;
this file is for working on the code.

## The people and their preferences

- The owner (parent) plays with their son, on desktop and **iPad/tablets**. Keep text short,
  friendly and readable by a child; error messages should say what to do next.
- **No Pokémon names or exact Pokémon terms.** All creatures, moves and gym names are original.
  Types that came from Pokémon were renamed: Poison → **Toxic**, Fairy → **Pixie**,
  Dragon → **Drake** (Psychic is **Mind**, Steel is **Metal**, and **Rainbow** is our own).
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
| `src/world.js` | Seeded terrain, trees, gym buildings (`placeGyms`/`buildGym`), chunk meshing, voxel raycast |
| `src/blocks.js` | Block ids, procedurally drawn texture atlas, per-type "wool" roof blocks |
| `src/species.js` | Types + effectiveness chart, moves, all 102 species (6 per type; the `roster` test checks this) (stats, learnsets, evolutions, model recipe), spawn tables, XP curve, blocky model builders + animation |
| `src/gyms.js` | The 16 gyms in difficulty order (teams, leader/trainer names, dialogue) |
| `src/battle.js` | Turn-based battles (wild and trainer), catching, XP share, evolution |
| `src/creatures.js` | Wild creature spawning (biome + day/night tables) and wandering |
| `src/npc.js` | Blocky people (trainers, leaders, Healer Hana, other players' avatars) |
| `src/ui.js` | HUD, team screen, creature portraits |
| `src/touch.js` | Tablet controls (joystick, drag-to-look, tap-to-interact, buttons) |
| `src/cloud.js` | Supabase: accounts, online saves, realtime channel |
| `src/multiplayer.js` | Play together: share code, avatars, block sync |
| `src/duel.js` | Player-vs-player battles over the play-together channel |
| `src/sound.js` | Quiet Web Audio sound effects (`sound.play(name)`), on/off in the pause screen |

Key ideas:
- `window.pokecraft` is the global `game` object (handy in tests and the console):
  `world`, `player`, `party`, `box`, `badges`, `beaten`, `cubes`, `battle`, `mp`, `npcs`, `creatures`.
- The world is **deterministic from its seed**; a save stores the seed plus the list of player
  block edits (`world.edits`, index → block id). Gyms are generated, not saved, so changing
  `placeGyms`/`gymSpots` moves gyms in existing saves (`continueGame` moves the player to spawn
  if they would start inside a wall).
- Save format: localStorage key `pokecraft-save-v2` (v1 saves are migrated: team kept, new world).
  Edits are indexed by map size, so saves record `size: [W, D]`; `convertEdits` moves edits from
  saves made with another size (no `size` = the old 192×192 map). The map is 224×224.
  The same object is upserted to Supabase when signed in; whichever has the newer `savedAt` wins.
- Adding a creature: add to `SPECIES` (use `L(type)` for a standard learnset) and to a biome in
  `SPAWNS`; the model is built from `shape` (`quad`/`blob`/`biped`/`bird`/`serpent`/`bug`) plus
  `extras`. Adding a type: `TYPE_COLORS`, `EFFECTIVENESS`, two moves + `T1`/`T2`, a wool colour in
  `blocks.js` if it gets a gym. Remember the README tables.
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

Specs: `battle-and-menu`, `gym`, `touch` (emulated iPad with real multi-touch), `multiplayer`
and `pvp` (two browsers, via `openPair`), `new-types`, `roster`, `map` (old-save migration), `sound`, `icon`, `cloud` (skipped without credentials). Gotchas learned the hard way:
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

- Two locked test accounts (`claude-test-a/b@pokecraft.invalid`) may still exist in Supabase;
  the owner was asked to delete them under Authentication → Users.
- The real Supabase Realtime path for play-together hasn't been exercised by automated tests
  (WebSockets blocked); the game logic around it has.
- Late gyms (levels 25–30) still need a fair amount of training; wild creatures top out lower.
