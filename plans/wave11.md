# Wave 11: shared decisions (T33 Food, T34 Squad, T35 Dream, T36 Parkour)

Read `ROADMAP.md` (section "Wave 11") and `CLAUDE.md` first. This file fixes everything the four tasks share so
they can be planned and built side by side. Each task has its own plan in `plans/T33.md` ... `plans/T36.md`.

## Step 0 (already on the branch)

- **Type ids:** `food`, `squad`, `dream`, `parkour`. `TYPE_COLORS` has all four (a task may tweak its own colour).
- **Chart** (`EFFECTIVENESS` in species.js, done; do not change other types' rows):
  Food beats squad, squad beats parkour, parkour beats dream, dream beats food.
  - food: squad 2, alien 2, treasure 2; food/bug/toxic/metal 0.5. Weak to fire, bug, toxic, dream; ice 0.5.
  - squad: parkour 2, camo 2, normal 2; squad/sky/slime 0.5. Weak to electric, sound, food; ghost 0.5.
  - parkour: dream 2, bone 2, cyber 2; parkour/sky/ghost/slime 0.5. Weak to grass, squad; rock 0.5.
  - dream: food 2, time 2, rainbow 2; dream/light/cyber 0.5. Weak to electric, time, parkour; cozy/mind 0.5.
- **Wool blocks:** food 79, squad 80, dream 81, parkour 82 (`WOOL.<type>`; plain colour tiles, a task may give its
  wool a pattern in `blocks.js` like cozy/treasure).
- **Block ids reserved:** 83-86 T33 (Restaurant), 87-90 T35 (Dream), 91-94 T36 (Parkour). Next free id: 95.
  Use only your own range; append your tiles to `MORE_TILES` in a commented group.
- `blocks` and `two-types` specs updated for 32 types and wool 79-82.

## Gyms, slots and levels

| Order in `GYMS` (append in this order) | Task | Where | Trainers | Leader (top level) |
| --- | --- | --- | --- | --- |
| 28 `food` (Restaurant) | T33 | slot 5 | 46-47 | 48 |
| 29 `squad` | T34 | slot 6 | 48-49 | 50 |
| 30 `parkour` (Obstacle Course) | T36 | slot 7 | 50-51 | 52 |
| 31 `dream` | T35 | inside the Dream realm | 52-53 | 54 |

- Each task appends only its own def to `GYMS` (the orchestrator puts them in this order when merging).
  `GYMS` is append-only; never reorder. Two trainers each (`trainers: [...]`), T19+ style.
- Gym teams use only that type's own new species (plus older species of a second type if wanted). Leaders may get
  their type's big moves via `movesWith`. Keep it on the easy side (the owner asked for easier gyms once).
- Slot gyms: `slot`, `build: '<name>'` registered in `SLOT_BUILDERS` (gymplace.js), builder in its own file, writes
  only inside `slot.box`, sets `protect`, `area`, `trainerPositions`. Slot 5 is the south slot nearest the start (T32).
  Each slot task bumps `WORLD_VERSION` from 12 to **13** (the same number in every task, so the merge is clean).
- Never change `MAP_GYMS` (27), `ORIGINAL_GYMS`, the spot rules or the `SOUTH` table.
- Specs that hard-code 27 gyms: change them to `GYMS.length` (or the right count) only where your task needs it.
- **The orchestrator does after merging (not the tasks):** Champion's Tower guards 55-58, Champion 57-60
  (Zenithar 60), `REMATCH_CAP` 63, Coach Dex one more team; `champion` spec numbers; README gym table order.

## Per-type data (every task)

- 7 species (the 7th single-stage with its own shape), at least 3 new body shapes in `shapes.js` in a section
  `/* ==== T3x <type> ==== */` appended at the end of the file and registered in `SHAPES`; species in a
  `/* ==== T3x <type> ==== */` section of `SPECIES`. `roster`/`seventh` specs: 7 per type, 3+ shapes per type.
- Moves: `T1`..`T4` entries for the type (4 normal moves), a signature move per final evolution where the old types
  have one, 2-3 `BIG_MOVES` entries (kinds the type leans towards, see the roadmap), `UTIL` if fitting. Move ids
  must be new (grep `MOVES` first), never named like a sound effect in `sound.js`.
- `fxrecipes.js`: `TRAVEL` / `IMPACT` / `FX_COLORS` for the type, `SIG` for each signature move; `sound.js`: an
  `fx:<type>` sound. The `fx` spec checks both.
- Spawns: T33/T34 normal biome tables (a `SPAWN_<TYPE>` table merged like `SPAWN_SKY`); T35 only the Dream realm's
  `spawns`; T36 a "high places" condition (see the roadmap).
- Book: everything is read from data; check the Book page of one new creature.
- README: type chart rows/columns, creature list, gym list; CLAUDE.md: the type count line ("32 types in all"),
  next free block id, a short note for your system. Keep README/CLAUDE.md edits to your own lines.
- Names: original, child-friendly, no Pokémon names or terms; not insects for Squad.

## Files each task owns (others: only the small hooks listed)

- **T33 Food:** new `src/restaurant.js` (builder + `RestaurantLive` pot + menu), hook in `main.js` `breakBlock`
  (ingredients), `rematch.js` hook for "next dish". Spec `food`.
- **T34 Squad:** `battle.js` (`weakensWithHp`), `duel.js` `VERSION` bump, `setModelHealth` (species.js) called where
  the HP bar updates, new gym builder file. Spec `squad`.
- **T35 Dream:** `realms.js`, `player.js` (gravity from the world, bounce block), realm gym placement/people/badge,
  healer in the realm, moon on the HUD. Spec `realms` (extend) + `dream`.
- **T36 Parkour:** `creatures.js` (run-away walk), `spawnrules.js` (high-places condition + `place`), new obstacle
  course builder file with a checkpoint live object. Spec `parkour`.

Shared files everybody touches a little (`species.js`, `shapes.js`, `fxrecipes.js`, `sound.js`, `gyms.js`,
`gymplace.js` `SLOT_BUILDERS`, `gymlive.js` `LIVE`, `main.js`, `README.md`, `CLAUDE.md`): keep your edits in your own
appended section or a single line so the orchestrator's merge is "keep both".
