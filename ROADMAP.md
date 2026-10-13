# PokeCraft roadmap

The owner picked these next. Each task below is written so one planner and one or more builders
can pick it up without the conversation that produced it. Read `CLAUDE.md` first: it has the
owner's preferences (original names only, child-friendly text, iPad support, easy gyms), the
branch rules and the test gotchas.

**Status (2026-10-13):** all five waves are done and merged (T1–T11; T4 became Bone/Alien types +
7th creatures, shiny was cancelled). Plans for every task are in `plans/`. Next: **wave 6**
(housekeeping, bug fixes and small owner requests, T12–T15), then **wave 7** (homes and three
new types: Cozy, Treasure, Cyber, T16–T19), then the backlog below.

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
| 3 ✅ | T4a Bone + Alien types (with gyms) → T4b a 7th creature per type | T4b needs T4a's types, so they run one after the other |
| 4 ✅ | T7 Attack animations | Needs the final move list; big enough for its own session |
| 5a ✅ | T8 Bigger caves + cave gyms · T9 Four new types (creatures) | World/caves vs. species/shapes data |
| 5b ✅ | T10 Four new gyms + special access · T11 Effects for the new types | Need T8's world and T9's types |
| 6a | T12 Bug fixes · T13 Storage box · T14 Night gyms (Comet at night, alien look; Saucer in the sky ✅) | Input/overlays vs. team-panel UI vs. world + NPCs |
| 6b | T15 Cleanup + faster tests | Touches every file, so it runs alone after 6a is merged |
| 7a | T16 Bigger map, treasure blocks, protected gyms · T17 Three new types (Cozy, Treasure, Cyber) | World generation vs. species/shapes/fx data |
| 7b | T18 Homes (Doormat, home types, meter, preview) | Needs T16's blocks and T17's creatures |
| 7c | T19 Three new gyms + a stronger Tower | Needs T16's new land and T18's homes (the Cozy Gym lives in a home) |

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

**Done** (plans `plans/T4a.md`, `plans/T4b.md`).

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

**Done** (plan in `plans/T7.md`).

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

## Wave 5 (owner request, 2026-10-12)

The owner's words, summarised: Bone creatures should only live in caves, and the Bone gym should be in
a cave too. Caves are too small to notice: make them much bigger and worth exploring (maybe another gym
in a cave). Four more types: **Sky, Slime, Light, Paper**, each with about as many creatures as the
others (7, with proper evolutions), some with their own moves and attack animations, and their own
gyms in fitting places (be creative: a Sky gym floating high up that you reach by building blocks to
climb; an Alien gym that only shows at night). The paper crane (Origrane, now mind) moves to Paper,
so Mind needs a new 7th creature. The map may grow if needed, but **existing games must not be lost**.

### T8 · Bigger caves + cave gyms (size: L) ✅ done (plans/T8.md)
- Caves much larger and explorable: long tunnels, big caverns, several levels if the height allows,
  more and easier-to-spot entrances (marked, e.g. a stone arch or a lamp), still under the surface only
  (terrain heights unchanged) and away from gyms on the surface, the tower and the start.
- The **Fossil Gym moves into a big cave cavern**, with a clear, lit way in; the guide arrow leads
  there. Old saves keep their Bone badge; the old surface building simply isn't generated any more.
- **Bone creatures only spawn in caves** (remove them from surface tables; the weather test rows for
  bone move to caves or go).
- Done when: caves are big (spec: cave air per world several times today's, a cavern ≥ N blocks),
  entrances visible, the Fossil gym is underground and reachable on several seeds, bone spawns only in
  caves, old saves load fine.

### T9 · Four new types: Sky, Slime, Light, Paper (size: L) ✅ done (plans/T9.md)
- Types with colours, a balanced effectiveness row/column, 4 moves each plus a few signature moves,
  weather boosts where natural (Sky: windy/clear days, Light: daytime/rainbow, Slime: rain/swamp,
  Paper: wind?). 7 creatures per type (two or three evolving families + a single), each family with
  its **own body shape**. Origrane becomes Paper (with its family/evolution if fitting); Mind gets a new
  7th creature with its own shape. Spawns in fitting biomes (Sky: peaks/mountains, Slime: swamps and
  caves, Light: meadows/day, Paper: forests/plains?).
- Done when: roster at 7 per type over 23 types, screenshots reviewed, Book filters work.

### T10 · Four new gyms with special access (size: L) ✅ done (plans/T10.md)
- A gym per new type in a fitting place: **Sky gym floating high** (reach it by building up; a hint
  sign/toast), **Slime gym** maybe in a swamp or a second cave gym, **Light gym** on a sunny hill,
  **Paper gym** e.g. a paper-lantern house. **Alien gym only appears (or opens) at night.**
- Champion needs all badges (22). Grow the map only if needed, keeping old saves' edits and existing
  gyms in place (see T4a's approach: extra spots, never move the original gyms).
- Done when: gym spec beats every new gym, old-saves spec passes, special access works (sky gym
  reachable only by climbing; alien gym only at night).

### T11 · Attack effects for the new types (size: M) ✅ done
- `fxrecipes.js` travel/impact for sky, slime, light, paper, and the new signature moves; sounds.

---

## Wave 6 · Housekeeping, bug fixes and small requests

The owner asked for a wave that is mostly cleanup. **The first rule of this wave: do not break
anything that works.** Every task keeps worlds deterministic from the seed, keeps old saves
loading with their team, badges and builds, and runs the full suite before merging. The only
planned change to an existing world was the Saucer Gym moving into the sky (done 2026-10-13); the
rest of wave 6 changes no world blocks.

### T12 · Bug fixes (size: M)

Found by the owner while playing and by reading the code (2026-10-13). Each fix gets a check in
a spec (the duel ones in `pvp`, the touch ones in `touch`, water in a new small `water` spec or `blocks`).

1. **Stuck on the team screen after accepting a duel (owner's report, high).** On the iPad, the
   son had the team screen open, a duel invite arrived (`#duel-ask` z-index 25 is drawn above the
   panel's 20) and he tapped "Battle!". `Duels.accept()` (duel.js) only checks `inBattle`, and
   `startBattle()` (main.js) never closes the panel. Then `togglePanel` returns early because
   `game.inBattle` is true, the full-screen panel covers the battle buttons, and `body.in-battle`
   hides the touch Pause button. Nothing works until a reload. The challenger's side has the same
   bug (they open the team screen or Book while waiting for "yes").
   Fix: `startBattle` closes any open panel/Book first (`game.ui.closePanel()`); as a safety net,
   the panel's Close button and Esc/P/B/C always close a panel, even in a battle.
2. **A duel waits forever if the other player stops answering (high).** "Waiting for X..." has
   no way out; `d.next()` only gives up when the other player leaves the world. Add a "Give up"
   button while waiting, and treat no answer for ~90 s as the other player leaving.
3. **Accepting an invite during another battle drops it silently (medium).** The invite box stays
   on top of a wild battle; tapping "Battle!" just closes it and the challenger sees "didn't
   answer" 30 s later. Starting any battle closes the invite and answers "busy".
4. **A guest is sent home in the middle of a battle when the host leaves (medium).** `ended('host-left')`
   reloads after 2.5 s even mid gym-leader fight. Wait until the battle is over.
5. **The joystick can stop working after a battle starts while it is held (medium, check on a
   real iPad).** `touch.reset()` never clears the joystick's pointer id, so later touches are
   ignored. Reset it there (and on `lostpointercapture`); also clear the jump button's pressed look.
6. **"X didn't answer" can pop up on the title screen (low).** Going to the main menu leaves the
   duel timers running. Add `duels.reset()`, called from `goToMenu` and `mp.close`.
7. **Can't climb out of water onto land (owner's report).** In `player.js`, the player only floats
   with the feet ~0.5 above the water, and jumping needs `onGround`, so a bank one block higher
   than the water can't be climbed; the owner had to dig two blocks to get out. Fix like
   Minecraft: while in water with jump held and walking into a block, give an upward push big
   enough to step onto a bank 1 block above the water (not 2). This uses the same jump key and
   touch jump button. Spec: start in water next to a 1-high bank, hold forward + jump, end on land.
8. **"Continue exploring" after battles (owner's question).** On tablets this button is already
   skipped (`battle.js`: only shown when `!g.isTouch()`). With a mouse it is needed: browsers only
   let a page take the mouse (pointer lock) right after a click or key press, and battles end
   with animations, not a click. Without the button you would land on the pause screen and need a
   click anyway, so it is the same one click, just clearer. **Plan: keep it on desktop, but make it
   quicker**: Enter, Space or E also press it (a key press lets the game take the mouse back), and
   the button says what happened (for example "Continue exploring (you caught Flicker!)").
   **Owner decided (2026-10-13): keep the button on desktop.**
9. **Anything else found while fixing** goes in the plan as its own numbered item, with a spec check.

Done when: each item above has a passing check, and `pvp`, `multiplayer`, `touch`,
`battle-and-menu` and the new water check pass twice in a row.

### T13 · Storage box: let creatures go, sort and filter (size: S–M)

The box (team panel, `ui.js` `refreshPanel` / `monCard`) is one long unsorted list and has no
way to remove creatures.

- **Let go:** a "Let go" button on box cards only (never on team cards, so the team can't
  be emptied). It asks first, in big, kid-friendly words: "Say goodbye to Flicker (Lv 12)? It goes back
  to the wild." with "Yes, let it go" / "Keep it". Can't be undone. The Creature Book keeps it as
  caught (the Book's `caught` list is never shrunk). Show a short toast afterwards.
- **Sort:** buttons for Newest (default, the current order), Level, Name and Type. The sort is only for
  showing; `game.box` keeps its order, so saves don't change. Remember the choice in
  localStorage (per device, like sound on/off).
- **Filter by type:** a row of type chips (only the types that are in the box, with a count), plus
  "All". Text stays short; chips are big enough for a child's finger on an iPad.
- Box count in the heading ("Box (37)"). Cards keep their "To team" button (index must be the
  real `game.box` index, not the sorted position; this is the easy bug to make).
- Duels and multiplayer are not affected (the box is never sent).
- Done when: a spec (extend `book` or a new `box` spec) lets a creature go (it's gone from
  the box, still caught in the Book, the save no longer has it), sorts and filters (the right
  cards in the right order, "To team" moves the right creature), and works with touch.

### T14 · Night gyms: the Comet Gym at night, alien-looking Saucer people (size: S–M)

Owner's requests: the Comet (Cosmic) Gym should only have its people at night, like the Saucer
Gym; and the Saucer people should look like aliens. (The Saucer Gym already floats in the sky:
done on 2026-10-13, see CLAUDE.md "The Saucer Gym floats". Don't change it here.)

- **Night flag vs. saucer:** today `def.night` means both "people only at night" and "has a
  flying saucer" (`npc.js` `populate`). Split it: `night: true` for both gyms, `saucer: true`
  only for the Saucer Gym. The closed-by-day message is per gym (`def.nightText`): Saucer "the
  aliens only visit at night!", Comet something like "the stargazers only come out at night!".
  Check the guide arrow (`updateGuide`) with two night gyms: by day it should point to the next
  open gym and mention the night gyms. The "welcome / closed" toast in `main.js` too.
- **Comet Gym at night:** only the flag and text. Its building and spot don't change (no world
  change, no `WORLD_VERSION` bump). Old saves: a beaten trainer stays beaten, badges are kept.
- **The Saucer people look like aliens (owner said yes, 2026-10-13).** Today Skywatcher Rin and
  Leader Zeeb are normal blocky people in alien colours (normal skin). Add an optional look in
  `gyms.js` (for example `look: 'alien'`) that `npc.js` draws: green or purple skin, antennae,
  big eyes. Comet people could get a star hat (small, optional).
- Done when: `new-gyms-access` checks the Comet Gym by day (closed, toast, arrow skips it) and by
  night (battles work), and the Saucer Gym still works (empty by day, battles at night); a
  screenshot shows the alien look; `gym`, `new-gyms`, `old-saves` and `champion` pass. Update
  README (gym list) and CLAUDE.md (night gyms).

### T15 · Cleanup and faster tests (size: M, after 6a is merged)

Only behaviour-free changes. Each step is its own commit, and the full suite runs at the end. **Never
touch** world generation order, random draws, spot/mask code (`gymSpots`, `extraGymSpots`,
`caveGymSpot`, `pickSpot`, `carveCaves`, `carveBigCaves`, `fillCavesNear` vs `fillNewGymCaves`) or
the save format. The `old-saves` and `caves` checksums must not change.

- **Dead code:** `cloudAvailable()` (cloud.js), `gymById` (gyms.js), `World.inNewGymBox()` (keep
  the `newGymBoxes` array, tests use it); `export`s that are only used inside their own file.
- **Game-loop work:** `npcs.pick()` raycasts every NPC model in the world every frame (22 gyms +
  tower). Only test NPCs within reach first. The same applies to the multiplayer avatar pick. Stop allocating new
  `Vector3`s in `player.eyePos`/`forward` each call; cache `#mp-hud`; drop the duplicate
  `npcs.setNight()` call in `updateGuide()` (`updateSky` already does it every frame).
- **Split big files without changing code:** move gym placement out of `world.js` (~900 lines, into
  `gymplace.js` attached to `World.prototype`); move accounts UI, the guide and the play-together UI
  out of `main.js`. Move code only, don't rewrite it; checksums prove nothing changed.
- **Small helpers:** the two identical `dry()` helpers in world.js can be one (not the third one in
  `pickSpot`, which reads the `ground` array and behaves differently at the map edge).
- **Tests:**
  - Shared helpers in `tests/helpers.mjs` (seed-a-save init script, `platform()`,
    `startWeakBattle`, `waitFor`).
  - Replace fixed `waitForTimeout` sleeps with `waitForFunction` (old-saves, new-gyms-access,
    multiplayer, champion, sound, weather).
  - `run.mjs` prints each spec's time, gives each spec a timeout so one hung spec can't stall
    the suite, and has `--skip`.
  - Optionally a "fast" group (roster, seventh, four-types, bone-alien, icon, blocks, map) that can
    run first.
  - Specs that fail late in a long run under load (`moves`, `pvp`, `sound`, `touch`, `weather`
    on 2026-10-13, all passed alone) get looked at: waits that depend on frame rate should wait
    for a condition instead.
- **Docs:** CLAUDE.md test list (add `caves`, `moves`, `seventh`, `bone-alien`, `new-gyms-access`,
  plus T12–T14's specs), the Pages note ("being moved" to `main` is done), `.gitignore` duplicate
  lines. Optional: a simple way to make browsers fetch new versions after an update (the owner
  saw the old 18-gym version on the iPad after the T10 release), for example a version string
  on the script URLs in `index.html`, without a build step.
- Done when: the full suite passes (alone, once, each flaky spec retried once at most), the
  `old-saves`/`caves` checksums are unchanged, and the suite is no slower than before.

---

## Wave 7 · Homes and three new types: Cozy, Treasure, Cyber

Agreed with the owner on 2026-10-13 (a long design talk; this section is the result, so the
conversation isn't needed). Two creature types are found **only near a home the player builds**
(Cozy, Treasure), one **only when two players play together** (Cyber). Each type gets a gym, the
map grows to make room, and the Champion's Tower needs all 25 badges.

**Written before T15 (cleanup) lands:** T15 moves code between files (gym placement out of
`world.js`, UI out of `main.js`) and adds test helpers. Names below describe *what* to change, not
where it lives today; planners read the code as it is after wave 6.

**Rules for the whole wave** (on top of CLAUDE.md):
- **Old worlds stay as they are.** The old 224×224 area is block-for-block the same as before
  (`old-saves` proves it, and its checksums only change where a task says so). No old gym, cave,
  the tower or a build moves. New content (gyms) goes **only in the new land**.
- **Keep it simple, keep it object-oriented.** The owner pushed back on special cases ("too many
  exceptions"). Prefer one general rule or one general class with data-driven variants over
  one-off code paths. Homes in particular must be built so wave 8 can add Grass/Rock/... homes as
  data only (see T18).
- Original names only, short child-friendly text, works on iPad (touch) as well as desktop.

### T16 · Bigger map, treasure blocks, protected gyms (size: L)

**1. The map grows to 288×288: 64 new blocks on the east (+x) and south (+z) sides.**
- The old map keeps its coordinates (x, z 0–223), so builds and edits line up. Saves already
  record `size`; old sizes are converted the same way as the earlier 192 → 224 growth.
- Terrain comes from noise at absolute x/z, so it simply continues into the new land. **But every
  calculation that today looks at "the whole map"** (height percentiles for mountains/snow/peaks,
  gym/tower/cave-gym spot searches, cave carving, plants, keep-outs, map-edge rules) **must keep
  using exactly the old 224×224 area** for old content, or biomes and gyms in old worlds would
  shift. The planner lists every such place. The new land gets its own pass (biomes from the same
  rules, plants, small caves optional) that only writes outside the old area.
- The **start point stays where it is** (today it is the middle of the map, which would move).
- The map edge: whatever happens at today's edge (water, cliffs) now happens at the new edge; the
  seam at x/z = 224 should look natural (no wall, no step). Check screenshots on a few seeds.
- **Measure load time and memory** on the slow renderer and with an iPad-sized viewport before
  and after (the owner's son plays on an iPad). If it gets much slower, say so in the plan.
- Bump `WORLD_VERSION`; multiplayer guests get the bigger world.

**2. Three treasure blocks you can only mine: Sunstone (warm shining gold), Ruby (red), Sapphire (blue).**
- New blocks with their own names and textures, clearly different from Gold Ore and Star
  Crystal (those stay as they are, free in the Blocks panel).
- Found in the world: in cave walls and deep under hills, rare. Old areas may get them only
  underground in stone (no visible surface change); the planner decides whether old worlds get
  them at all or only the new land plus caves, and updates the `old-saves` checksum on purpose.
- **You collect the block itself:** breaking one adds 1 to your count; placing one uses 1. The
  Blocks panel shows them with a count ("Ruby ×3") and greys them out at 0. All other blocks stay
  unlimited. Counts are saved per player (new optional save field; old saves start at 0).
- Fix found during the design talk: breaking a **placed** Gold Ore can give a Capture Cube, so
  place-and-break farms cubes. Only natural (not player-placed) gold ore should give cubes.

**3. Gyms can't be broken into.** One rule for every gym (all 22 today plus T19's): blocks inside
a gym's building/area can't be broken, and blocks can't be placed there. Building *outside* a gym
stays allowed (the Cloud/Saucer pads need pillars; T19's Treasure roof key needs a way up). The
planner defines each gym's protected box (cave gyms include their cavern; sky gyms their
island) and shows a short toast ("Gym walls are too strong to break!").

Done when: `map` and `old-saves` pass (old area unchanged apart from planned treasure blocks), a
new spec checks the seam, the start point, treasure-block counts (mine, place, save, load) and
gym protection (break/place inside fails, outside works), load time noted in the plan.

### T17 · Three new types: Cozy, Treasure, Cyber (size: L)

Like T9: type colours, effectiveness, moves (own moves + a few signature moves with `fx`),
`TRAVEL`/`IMPACT`/`FX_COLORS` and an `fx:<type>` sound, wool colours (for gym roofs), README
tables, Book filters. **7 creatures per type, like every other type: three families that evolve
once, plus one that doesn't.** Every family gets its **own body shape** (new builders in
`shapes.js`); the roster spec's rules apply (23 → 26 types).

The owner's naming notes: the Treasure type's creatures are what the owner calls "shiny
creatures", but "shiny" is a Pokémon term, so the **type is named Treasure**; creatures should
sparkle all the time (a small twinkle effect on the model, cheap on the slow renderer).

| Type | Family 1 | Family 2 | Family 3 | Single |
| --- | --- | --- | --- | --- |
| **Cozy** (no teapots: soft, sleepy, warm) | Snugbun (bunny rolled in a blanket) → Quiltbun (quilt cape) | Purrmit (kitten in a mitten) → Knitcat (cat in a knitted sweater) | Pillowool (sheep made of pillows) → Dozeram (sleepy ram, pillow horns) | Snoozebear (bear in pyjamas and slippers) |
| **Treasure** (gold/gem colours, always sparkling, not always animals) | Coinlet (a rolling gold coin) → Kingcoin (coin stack with a crown) | Crystafox (crystal fur) → Prismfox (fur that throws rainbows) | Ringlet (floating ring, gem eye) → Crownguard (walking crown, gem armour) | Chandelia (floating glittering chandelier) |
| **Cyber** (pixels, screens, glitches) | Pixbit (pixel blob) → Pixbit 2.0 | Clickit (mouse cursor with legs) → Clickit 2.0 | Wifly (butterfly with Wi-Fi wings) → Wifly 2.0 | Error 404 (small glitchy ghost) |

Names are proposals; the planner checks they are original. Cyber evolutions keep the name and add
"2.0" (the owner likes this); the 1.0 model can look blockier, 2.0 sharper.

**Matchups the owner approved** (the planner balances the rest of the rows/columns):
- Triangle: **Cozy beats Cyber** (put the screens away and cuddle), **Cyber beats Treasure** (a
  hacker cracks the safe), **Treasure beats Cozy** (bling outshines a blanket).
- Cyber: strong vs Metal, Mind, Paper ("going paperless"); weak to Water (shorts out) and Bug
  (computer bugs!); resists Electric.
- Cozy: strong vs Ice (warms it up) and Ghost (nothing is scary at home); weak to Bug (moths eat
  wool) and Toxic; resists Ice.
- Treasure: strong vs Drake (distracted by gold) and Pixie; weak to Slime (gunk) and Toxic
  (tarnish); resists Normal.
- No special battle mechanics for these types (the owner said no to "scan"/"copy-paste").

**Where they appear** (the spawn rules; T18 provides the homes):
- **Cozy / Treasure: never in biome tables.** Only near a finished home of that type (T18). At
  most one at a time per home. Cozy a bit more often in the evening. Treasure is **rare** even at
  a treasure home (roughly one every few in-game days; planner tunes).
- **Cyber: only when two players are in the same world and within ~30 blocks of each other**, and
  even then uncommon (about 1 in 15 spawns, at most one at a time). Each player has their own wild
  creatures, as today.
- The spawn tests and the roster spec must allow types with no biome spawns (the planner adds a
  clear list of "special-spawn" types rather than special-casing them one by one).

Done when: roster (26 types × 7), fx and sound specs pass, screenshots of all 21 creatures
reviewed, matchups in the type chart, spawns covered by a spec (cyber with `openPair`).

### T18 · Homes: Doormat, home types, meter, preview (size: L)

**The design (owner-approved):**
- **Doormat:** a new free block. **One per player** (placing a new one moves your home). In
  play-together each player can have one; homes and their creatures work for everyone, but the
  Cozy Gym (T19) only moves into the **world owner's** home.
- **"What kind of home?"** The first time you stand on a new Doormat it asks, with big pictures
  (Cozy, Treasure; more types later). One type per home; change it any time on the Doormat.
- **What counts as a home** (any type), checked around the Doormat:
  1. Floor inside at least **8×8**; anything up to **20×20** counts.
  2. Walls closed all round, at least **3 blocks high**, with **one door gap** (1–2 wide).
  3. A full roof over the whole inside.
- **Cozy home:** at least half of the wall blocks are Planks, Log or Pine Log, plus **at least 3
  of these 5** inside (each is a heart on the meter): a **Bed** (new block), a **Fireplace** (new
  block, glows and flickers), a **Rug** (4+ wool on the floor), a **Lamp**, **2+ Glass** in the
  walls. 5 hearts = cozy creatures come more often.
- **Treasure home:** a home with at least **10 treasure blocks** (T16's Sunstone/Ruby/Sapphire)
  in its walls or floor; a gem counter on the meter ("6/10").
- **Guidance without lots of text** (the owner asked for this):
  - Standing on the Doormat shows a row of **icons** (walls, roof, size: tick or cross; then the
    type's features as pictures that light up, with hearts or a gem counter).
  - **Gaps in the walls or roof glow red** while you stand on the Doormat; a too-small room shows
    its floor outline. You see where to put a block.
  - A **"Show me a house" button** opens a small panel with a **slowly spinning 3D model** of an
    example home of the chosen type (drag to turn, pinch/scroll to zoom). Features you are still
    missing **blink** on the model. (No ghost blocks in the world; the owner said no. No example
    house built in the world either.)

**Object-oriented, so wave 8 can add homes as data only** (the owner wants Grass, Rock, ...
homes later):
- **`Home`** (one class for every type): finds the room around the Doormat and checks floor,
  walls, roof and door. Produces a **room report** (wall blocks, floor blocks, inside blocks,
  the holes it found). Knows nothing about Cozy or Treasure.
- **`HomeType`** (one data object per type): the creature type it attracts, its picture, a
  **wall rule**, a list of **features**, how many are needed, how to show progress (hearts or a
  counter), its **example model** (a small block list), spawn tuning, and `gymMovesIn` (Cozy).
- **Features** are small reusable checks with an icon: "has block X", "at least N of these
  blocks (on the floor / in the walls / inside)", "at least half the walls are these blocks".
- The meter, red glow, preview and spawning only read the chosen `HomeType`; none of them has
  type-specific code. Adding a type = one new `HomeType` entry (+ its picture).
- Wave 8 note: types that already live in the wild would come *more often* (or rarer ones) at
  their home; decide then.

**Save:** the Doormat is a normal block edit; the chosen home type is saved per player (optional
field, old saves have no home). Re-check a home when blocks near it change (not every frame).

Done when: a `homes` spec builds a cozy and a treasure home from block lists (on a platform, like
the other specs), checks every rule (too small, open roof, no door, two gaps, not enough wood,
2 of 5 features) with the meter's icons, sees a cozy/treasure creature appear, and checks a
test-only extra `HomeType` works with no other code changes; touch spec covers the chooser and
the preview; screenshots of the meter, red glow and spinning model reviewed.

### T19 · Three new gyms and a stronger Tower (size: L)

Order and levels (each harder than the last; the last ones quite hard): **Cozy 31–33,
Treasure 34–36, Cyber 37–40 (4 creatures)**. Each has an assistant/trainers and a leader, badge,
wool roof colour, dialogue, guide-arrow support, like the other gyms. Treasure and Cyber are built
**only in T16's new land** (so they can never land on old builds or gyms); all T16 protection
rules apply.

- **Cozy Gym: the leader moves in.** No building. Once the world owner has a finished cozy home
  **and has caught 3 cozy creatures**, the leader and their assistant knock on the door and move
  in: they stand inside the home and battle like any gym (assistant first). If the home stops
  being cozy (someone breaks the bed), they say "Brr, it's chilly in here, can you fix it?" and
  won't battle until it's cozy again. If the Doormat moves, they move with it. The guide arrow
  points home once they have moved in, and before that says what to do (build a cozy home /
  catch 3 cozy creatures). This is `gymMovesIn` on the Cozy `HomeType` (T18), not a special case
  in the gym list.
- **Treasure Gym: three golden keys.** A vault building with a locked vault door; the leader is
  inside. Three **Key Chests** (one new block, a gold chest that gives a key when opened, like
  the cave chests) hidden in three places that need three different skills:
  1. **Dig:** a gold **X** on the ground near the gym; the chest is about 10 blocks down through
     stone.
  2. **Build:** on the **roof** of the tall vault (about 14 up); you build your own way up from
     outside (the roof itself is protected, so you can't dig through it).
  3. **Explore:** in a cave near the gym, at the end of a tunnel.
  Keys are **per player** (a Key Chest opened by one player still gives the other player their key).
  **A subtle key compass:** near the gym only, a small key icon on the HUD glints faster as you get
  closer to a key you haven't found. No map and no other hints (the owner said so). It shouldn't
  be easy, but never "lost": all three within ~40 blocks of the gym.
- **Cyber Gym: the firewall maze.** Three rooms, each a maze of **red and blue laser walls**
  (floor to ceiling, glowing). Stepping on a red switch turns red walls off and blue walls on, and
  the other way round. Each room is a bit harder; a trainer at each exit, the leader in the
  middle "server room". No punishment: walls only block, and a **reset button** at each room's
  door puts the room back. An optional co-op shortcut switch that needs one player to stand on
  it while the other walks through (never required; solo play must work). T16's protection makes
  the walls unbreakable and stops building over them.
- **Champion's Tower:** needs **all 25 badges**, with **no exception** for players who were
  already Champion with 22 (the owner decided; today old Champions keep access). Guards, coach and
  Champion get stronger so the Tower is harder than the Cyber Gym (about levels 42–45). Old saves
  keep their badges and Champion title.

Done when: the gym spec beats all three new gyms (the Cozy Gym in a test home, the three keys
found and the vault opened, the maze solved with switches), the Tower refuses with 22 badges and
battles with 25, `old-saves`, `champion`, `new-gyms`, `multiplayer` pass. README (gyms, homes,
types) and CLAUDE.md updated.

---

## Backlog (later)

Owner likes these, but not now: **riding creatures** (run on Duskmare/Blizzbear, swim on
Torrentide, fly on Stormwyvern/Boomwing), **creature helpers** (fire lights lamps, rock digs
faster, sound reveals hidden ore), **music blocks**, **photo mode**, **trading** between
players, **simple crafting** (logs → planks, stone → stone bricks, gold → Capture Cubes).

Still open from before (see CLAUDE.md): late gyms need a lot of training; the real Supabase
Realtime path for play-together isn't covered by automated tests.
