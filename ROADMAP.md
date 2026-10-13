# PokeCraft roadmap

The owner picked these next. Each task below is written so one planner and one or more builders
can pick it up without the conversation that produced it. Read `CLAUDE.md` first: it has the
owner's preferences (original names only, child-friendly text, iPad support, easy gyms), the
branch rules and the test gotchas.

**Status (2026-10-13):** all five waves are done and merged (T1–T11; T4 became Bone/Alien types +
7th creatures, shiny was cancelled). Plans for every task are in `plans/`. Next: **wave 6**
(housekeeping, bug fixes and small owner requests, T12–T15), then the backlog below.

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
| 6a | T12 Bug fixes · T13 Storage box · T14 Night gyms (Comet at night, Saucer in the sky) | Input/overlays vs. team-panel UI vs. world + NPCs |
| 6b | T15 Cleanup + faster tests | Touches every file, so it runs alone after 6a is merged |

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
planned change to an existing world is T14 (the Saucer Gym moves up into the sky, at the same x/z).

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
   the button says what happened (for example "Continue exploring (you caught Flicker!)"). Ask the
   owner if they would rather skip it on desktop too and accept the pause screen.
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

### T14 · Night gyms: the Comet Gym at night, the Saucer Gym in the sky (size: M–L)

Owner's requests: the Comet (Cosmic) Gym should only have its people at night, like the Saucer
Gym; and the Saucer Gym should float in the sky like the Cloud Gym, still only open at night.

- **Night flag vs. saucer:** today `def.night` means both "people only at night" and "has a
  flying saucer" (`npc.js` `populate`). Split it: `night: true` for both gyms, `saucer: true`
  only for the Saucer Gym. The closed-by-day message is per gym (`def.nightText`): Saucer "the
  aliens only visit at night!", Comet something like "the stargazers only come out at night!".
  Check the guide arrow (`updateGuide`) with two night gyms: it should point to the next open gym
  by day and mention the night gyms, and the HUD toast in `main.js` too.
- **Comet Gym at night:** only the flag and text. Its building and spot don't change. Old saves:
  a beaten trainer stays beaten, badges are kept.
- **The Saucer Gym in the sky:** keep its x/z from `extraGymSpots()`. That list is also an input to
  the cave masks and `newGymSpots()`, so keeping it means no other gym, cave or the tower moves.
  - Build it like the Cloud Gym (`placeSkyGym`: cloud island with lamps underneath, sky building,
    landing pad + lamp post in front of the door, one jump from a pillar on the pad). Use a
    metal/dark island or a saucer-shaped platform instead of cloud blocks if it reads better;
    planner decides with screenshots.
  - The surface building is no longer built: the ground there goes back to normal terrain and
    plants. **This is the only change to old worlds in this wave.** List it in the plan, and keep it
    inside one box around the spot (like `newGymBoxes`); `old-saves` checks that everything outside
    that box is block-for-block the same, and its checksum is updated on purpose.
  - Height: `fy = min(36, maxG + 12)` like the Cloud Gym. The Saucer spot was picked as "far from
    everything", not "low ground", so the planner must measure over many seeds (for example
    1–300) how often the hills near it are too high for an island below `WORLD_H` (48), and pick
    a fallback (a lower island or keep it on the surface). Never move the x/z.
  - Old saves that were standing inside the old building: `continueGame` already moves a player
    who would start inside a wall to spawn; also handle someone saved on the old floor (they just
    fall a little, which is fine). Bump `WORLD_VERSION` (multiplayer `wv`).
  - The flying saucer hovers over the island and lands on it at night; the "up in the sky" arrow
    hint and pad/near-gym hints (`skyToldNear`/`skyToldPad`) work for both sky gyms (today they
    use `.find(g => g.sky)`).
- **The Saucer people look like aliens.** Today Skywatcher Rin and Leader Zeeb are normal blocky
  people in alien colours (normal skin). Give night-gym NPCs an optional look in `gyms.js`
  (green/purple skin, antennae, big eyes) in `npc.js`. Comet people could get a star hat. Small and
  optional; ask the owner.
- Done when: `new-gyms-access` checks the Comet Gym by day (closed, toast) and by night (battles
  work), the Saucer Gym is in the sky, climbable from its pad, empty by day and battle-able at
  night; `old-saves` passes with only the Saucer box changed; `gym`, `new-gyms`, `champion` and
  `multiplayer` pass. Update README (gym list) and CLAUDE.md (night/sky gyms).

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

## Backlog (later)

Owner likes these, but not now: **riding creatures** (run on Duskmare/Blizzbear, swim on
Torrentide, fly on Stormwyvern/Boomwing), **creature helpers** (fire lights lamps, rock digs
faster, sound reveals hidden ore), **music blocks**, **photo mode**, **trading** between
players, **simple crafting** (logs → planks, stone → stone bricks, gold → Capture Cubes).

Still open from before (see CLAUDE.md): late gyms need a lot of training; the real Supabase
Realtime path for play-together isn't covered by automated tests.
