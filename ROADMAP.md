# PokeCraft roadmap

The owner picked these next. Each task below is written so one planner and one or more builders
can pick it up without the conversation that produced it. Read `CLAUDE.md` first: it has the
owner's preferences (original names only, child-friendly text, iPad support, easy gyms), the
branch rules and the test gotchas.

**Status (2026-10-12):** waves 1 and 2 are done and merged (T1, T2, T3, T5, T6). Next: wave 3 (T4),
then wave 4 (T7). Plans for finished tasks are in `plans/`.

## How to run this (multi-agent)

The owner wants tasks run by subagents rather than one at a time by hand:

- **The main session orchestrates.** It picks the next wave, starts the agents, merges their
  branches in order, runs the full test suite, and pushes (session branch, then `main` and
  `claude/clever-ritchie-etj0nq`, fast-forward only).
- **Per task: an Opus planner, then Sonnet builder(s).**
  1. *Planner* (`model: opus`, read-only): reads the task below plus the code it touches, and
     writes a step-by-step plan to `plans/<task-id>.md`: files and functions to change, data
     formats, save-format changes, test changes, and anything to decide with the owner.
  2. *Builder* (`model: sonnet`, `isolation: "worktree"`): follows the plan, writes or updates
     the task's spec in `tests/specs/`, runs it plus the related specs, and commits on its own
     branch. Large tasks can use two builders (for example data + UI) if the plan splits the
     files cleanly.
  3. *Review*: the orchestrator (or an Opus reviewer agent) reads the diff against the plan and
     the "Done when" list, and looks at screenshots of anything visual before merging.
- **Waves** group tasks that touch different files, so they can run side by side. Run one wave
  at a time and merge it before starting the next.
- **Testing in parallel is slow.** The browser tests use software WebGL (~1–2 fps). Let builders
  run only their own specs; the orchestrator runs the full suite once per wave after merging.
  Each worktree needs `cd tests && npm install` (or a symlinked `node_modules`).
- Lessons from waves 1–2: give the orchestrator's full-suite run the machine to itself (parallel
  browser tests make `pvp` and `battle-and-menu` time out); check a test's condition right after
  waiting for it, not after a slow screenshot (the game keeps running at 1–2 fps); merges between
  waves were only small "keep both" conflicts in `main.js`, `sound.js`, `style.css`, `CLAUDE.md`.
- Every new spec must avoid world-dependent flakiness (see the platform trick in
  `tests/specs/pvp.mjs` and `sound.mjs`: build a stone platform high in the air and stand on it).

| Wave | Tasks | Why together |
| --- | --- | --- |
| 1 ✅ | T1 Creature Book · T2 Weather · T5 Final boss | Mostly separate files (UI / new weather module / gyms + world placement) |
| 2 ✅ | T6 More moves · T3 Caves | Battle + species moves vs. world generation + cave spawns |
| 3 | T4a Bone + Alien types (with gyms) → T4b a 7th creature per type | T4b needs T4a's types, so they run one after the other |
| 4 | T7 Attack animations | Needs the final move list; big enough for its own session |

T3 (caves) and T7 (animations) are the largest; each could take a session of its own.

---

## T1 · Creature Book (size: M)

**Done** (plan in `plans/T1.md`).

A book of every creature that fills in as you play. **No rewards**: filling it in is the fun.

- Every creature has a page. Not seen yet: a dark silhouette and "???". Seen (in the wild or
  in a battle): its picture and name. Caught: everything.
- When caught, it works like a little wiki for the game: picture, name, type (with colour),
  description, where it lives and when (from `SPAWNS`: biomes plus day/night), what it evolves
  from and into (and at which level), the moves it learns and at which levels, and its type's
  strengths and weaknesses (from the effectiveness chart).
- Counters at the top: "Seen 34 / 102 · Caught 21 / 102". Filters by type; sort by number.
- Opens with a key (for example **C**) and a touch button next to Team/Blocks; works on iPad.
- Save: add `seen` and `caught` lists (species ids) to the save. Old saves: mark the
  species in the party and box as caught and seen.
- Everything is read from `SPECIES`, `SPAWNS`, `MOVES`, so future creatures appear on their own.
- Silhouettes: render the portrait with all materials black (`ui.js` `portrait()`), cached.
- **Done when:** a spec checks a new game starts with just the starter seen and caught;
  meeting a wild creature marks it seen; catching marks it caught; the page
  shows where/when it lives and its evolution; old saves get their team marked caught; works
  with touch.

## T2 · Weather (size: M–L)

**Done** (plan in `plans/T2.md`).

Changing weather that changes what you find.

- **Rain** (plains, forest, meadow, swamp): falling rain particles, darker sky, rain sound
  (quiet). Water creatures appear more often.
- **Thunderstorms** (sometimes, from rain): flashes and distant thunder (quiet!). Electric
  creatures appear much more often.
- **Snowfall** in taiga / snow / peak (instead of rain): falling snowflakes. Ice creatures
  appear more often.
- **Rainbow after rain**: a rainbow arc in the sky for a few minutes; rainbow creatures become
  much easier to find (they are very rare otherwise). Show a toast: "A rainbow! Rainbow
  creatures love this."
- More ideas, pick what fits: **sandstorms** in the desert (rock/fire boost, a bit of haze),
  **fog** in swamps in the morning (ghost boost), **shooting stars** on clear nights (cosmic
  boost, make a wish toast), **aurora** over peaks on some nights (cosmic/rainbow boost),
  **windy days** (flying creatures more common, leaves drifting).
- Weather is per place (by biome) but from one shared "weather state" that changes every few
  minutes. In play-together, the host's weather is sent to visitors (like `time`).
- Spawn boosts: multiply weights in `CreatureManager.pickEntry` by weather; keep the table data
  in `species.js` untouched. Weather must never block spawns entirely.
- Particles must be cheap on iPad (one `THREE.Points` near the camera, a few hundred points).
- Probably a new `src/weather.js`; hooks in `main.js` (sky colour, fog), `creatures.js`
  (weights), `sound.js` (rain/thunder, very quiet, off with the Sound button), `multiplayer.js`.
- **Done when:** a spec can force each weather (for example `game.weather.set('storm')`) and
  check the spawn mix shifts (simulate spawns like the night test in `blocks.mjs`), the
  particles exist, the rainbow appears after rain, and visitors get the host's weather.

## T3 · Caves (size: L)

**Done** (plan in `plans/T3.md`).

Underground caves to explore.

- Carve winding caves with 3D noise **below the surface only**: keep terrain heights unchanged
  (old saves' builds must line up; see CLAUDE.md). Leave a solid layer near the surface except
  at some cave entrances on hillsides. No caves under gyms, the spawn point or water.
- Inside: ore (coal, gold), glowing **star crystals** and maybe a new glowing mushroom block,
  underground lakes, and a few rare treasure spots (a Capture Cube "chest" block?).
- **Darkness**: caves should be dark, with lamps and crystals glowing. Today brightness is
  global (`materials.solid.color`). Option: per-vertex light in `buildChunk` (sky light: blocks
  under open sky are lit, decreasing underground) plus the glowing material. Keep it simple and
  fast; test on the slow renderer.
- **Cave creatures**: a `cave` spawn table in `SPAWNS` (Echobat, Pebblor, Magmole, Quartzle,
  Nutlet, ghost ones, Glowbug...). Spawning currently only uses the surface (`World.surface`,
  `groundY`); when the player is underground, spawn in nearby cave air instead.
- The player needs light: lamps exist; maybe the lead creature glows a little underground.
- **Done when:** worlds have caves (spec counts cave air below the surface and entrances), no
  caves under gyms/spawn/water, old-save heights unchanged (the `map` spec still passes), cave
  creatures spawn underground, caves are darker than the surface, and frame time is still OK.

## T4 · New types + a 7th creature for every type (size: L)

Changed by the owner (2026-10-12): **shiny creatures are cancelled.** Instead:

- **T4a:** two new types, **Bone** (skeletons, skulls, fossils; friendly, not scary) and **Alien**,
  six creatures each with their own body shapes, a **gym for each**, and the Champion's Tower now
  needs all 18 badges. The map may grow if the new gyms need room (old saves must still line up).
- **T4b:** one new creature for each of the 19 types, each with its **own body shape** in
  `src/shapes.js` (no recolours), an original name, a short child-friendly description, stats, a
  learnset and a place to live. Ideas: a ghost lantern that floats, a cosmic black-hole puff, a
  sound jukebox crab, a mind origami crane, a metal wind-up toy, a toxic pitcher plant, a pixie
  teacup, a cloud drake, a rainbow chameleon, an ice snow-globe, a fire candle, a water jellyfish,
  a grass bonsai turtle, an electric light-bulb firefly, a rock geode, a normal patchwork plushie,
  a bug snail with a spiral shell.
- **Done when:** roster spec at 7 per type and ≥3 shapes per type passes; screenshots of all new
  creatures reviewed.

## T5 · Final boss (size: M)

**Done** (plan in `plans/T5.md`).

A much harder final battle after all 16 badges.

- A special place (for example a **Champion's Tower** or a floating sky arena near the middle
  of the map) that only opens after 16 badges. Placed like gyms (`placeGyms`/`buildGym` in
  `world.js`), so existing saves get it too.
- One or two guards, then the **Champion** with a team of 6 at levels ~40–45, mixed types,
  and a special final creature (could be one of T4's, or a one-of-a-kind legendary).
- Ideas to make it feel like a boss: a short story intro, the champion's last creature
  "powers up" at half HP, special music (quiet!), a big celebration and a title ("Champion")
  shown on the HUD afterwards. A rematch option.
- Mind the open item in CLAUDE.md: late gyms already need training and wild creatures top out
  lower. Make sure a player can reach the needed levels (for example wild levels rise slowly
  after all badges, or the tower has a training floor with strong trainers to battle).
- **Done when:** spec: tower exists in every world, refuses before 16 badges, a strong test
  team can beat the guards and the champion, the win is saved.

## T6 · More attack types (size: L)

**Done** (plan in `plans/T6.md`).

The moves get repetitive (Quick Jab, Body Slam...). Today there are 36 moves: two per type plus
a few normal ones, and most creatures use the standard `L(type)` learnset.

- About **4–5 moves per type** (~80 total), all with original names, with real variety:
  different power/accuracy, priority moves, moves that never miss, **simple effects** (heal a
  bit, raise attack/defence, lower the foe's attack/speed, a chance to make the foe flinch or
  fall asleep for a turn, multi-hit, recoil). Keep effects few and easy to understand for a
  child; show them in the battle log.
- Learnsets: extend `L(type)` so creatures learn several type moves at different levels plus a
  move from a second, matching type (so not every creature of a type is the same). Signature
  moves for a few special creatures.
- **Choosing which move to forget**: today `gainXp` silently forgets the oldest move. With
  more moves, ask the player (a small battle prompt: "Learn X? Forget which move?").
- **Player battles**: effects must use `battle.rng` and run in the same order on both sides
  (see `duel.js` notes in CLAUDE.md); the `pvp` spec must still show both browsers agree.
- Existing saves: creatures keep their moves; they learn new ones as they level.
- **Done when:** specs: every type has ≥4 moves, effects work (a spec for each effect kind),
  the forget-a-move prompt works (mouse and touch), and `pvp` still passes.

## T7 · Attack animations (size: L, its own session is fine)

Today a hit only flashes the target red. Give each move a little animation, at least per type,
with special ones for signature moves:

- Electric: a zig-zag **bolt** from attacker to target. Fire: **flames/embers**. Water:
  **bubbles/splash**. Grass: **leaves** swirling. Ice: **ice shards**. Rock: falling
  **pebbles**. Pixie: **sparkly dust**. Ghost: a **shadow** that swoops. Mind: **rings/waves**.
  Toxic: **purple bubbles**. Metal: **sparks**. Bug: a **buzz** of dots. Drake: a **roar wave**.
  Rainbow: a **rainbow beam**. Cosmic: **stars/comet**. Sound: **music notes / sound rings**.
  Normal: a **dust puff** and impact star.
- Probably a new `src/fx.js` with small particle helpers (cheap on iPad), called from
  `Battle.useMove`; keep the red flash for the hit itself. Add matching quiet sounds where
  missing.
- **Done when:** every move type has an effect (a spec calls each and checks objects are added
  and cleaned up), no slowdown on the slow renderer, screenshots reviewed.

---

## Backlog (later)

Owner likes these, but not now: **riding creatures** (run on Duskmare/Blizzbear, swim on
Torrentide, fly on Stormwyvern/Boomwing), **creature helpers** (fire lights lamps, rock digs
faster, sound reveals hidden ore), **music blocks**, **photo mode**, **trading** between
players, **simple crafting** (logs → planks, stone → stone bricks, gold → Capture Cubes).

Still open from before (see CLAUDE.md): late gyms need a lot of training; the real Supabase
Realtime path for play-together isn't covered by automated tests.
