# PokeCraft roadmap

The owner picked these next. Each task below is written so one planner and one or more builders
can pick it up without the conversation that produced it. Read `CLAUDE.md` first: it has the
owner's preferences (original names only, child-friendly text, iPad support, easy gyms), the
branch rules and the test gotchas.

**Status (2026-10-16):** waves 1–6 (T1–T15) are done and merged (T4 became Bone/Alien
types + 7th creatures, shiny was cancelled; T15 skipped the optional cache-busting version string).
Plans for every task are in `plans/`. Wave 7a (T16–T18: gym access objects, 288×288 map with protected gyms, Time/Camo/Cyber types) is done (plans `T16`–`T18`).
Wave 7b (T19: Clock Tower, Hidden Hill and Firewall Maze gyms, Tower at 25) is done (plan `T19`).
Wave 7.5 (T19.5: the Creature Book as a wiki, linked from the team screen) is done.
Wave 8 (T20–T23: treasure blocks, Cozy and Treasure types, homes, the Cozy Gym and Treasure Vault, Tower at 27) is done (plans `T20`–`T23`). Wave 8.5 (T23.5: the Firewall Maze exit door) is done. Wave 9 (T24–T30: battle fixes, big-decision moves, traits (Rideable), riding, harder gym rematches, Champion missions, hide and seek) and T30.5 (homes are every type they qualify for) are done (plans `T24`–`T30.5`). T31 (realms: a bare-bones Dream realm from your cozy home's Bed) and T32 (room for more gyms: the map grew south to 288 x 368, gym slots 5-9) are done, so wave 10 is done. Wave 11 (T33-T36: Food with the Restaurant, Squad with the Big Top Gym, Parkour with the Obstacle Course, Dream with a 256 x 256 Dream realm and the Upside-Down House; Tower at 31, guards 55-58, Champion 57-60) is done (plans `wave11.md`, `T33`-`T36`). Next: waves 12-15 below, then the backlog (including the backlog wave S1–S2: one shared world when playing together).

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
| 6a ✅ | T12 Bug fixes · T13 Storage box · T14 Night gyms (Comet at night, alien look; Saucer in the sky ✅) | Input/overlays vs. team-panel UI vs. world + NPCs |
| 6b ✅ | T15 Cleanup + faster tests | Touches every file, so it runs alone after 6a is merged |
| 7a ✅ | T16 Guide cleanup · T17 Bigger map + protected gyms · T18 Time, Camo, Cyber types | Guide/UI vs. world generation vs. species data |
| 7b ✅ | T19 Clock Tower, Hidden Hill, Firewall Maze gyms + Tower at 25 | Needs 7a |
| 7.5 ✅ | T19.5 Book wiki links | Small UI task (book.js, ui.js) between waves 7 and 8 |
| 8a ✅ | T20 Treasure blocks · T21 Cozy and Treasure types | World/blocks vs. species data |
| 8b ✅ | T22 Homes | Needs 8a |
| 8c ✅ | T23 Cozy and Treasure gyms + Tower at 27 | Needs T22 |
| 8.5 ✅ | T23.5 Firewall Maze exit (bug fix) | Small; before S1 (backlog), which changes the same `MazeLive` |
| 9a ✅ | T24 Battle fixes · T26 Traits · T28 Gym rematches | Battle rules vs. creature data vs. gym people |
| 9b ✅ | T25 Big-decision moves · T27 Riding | T25 needs T24's battle rules; T27 needs T26's Rideable |
| 9c ✅ | T29 Champion missions · T30 Hide and seek | Tower/world vs. play-together; T29's co-op boss uses T25's moves |
| 10 ✅ | T31 Realms ✅ · T32 More room for gyms ✅ | Both careful world work; can run side by side (realm world vs. main map) |
| 11 ✅ | T33 Food · T34 Squad · T35 Dream · T36 Parkour | Need wave 10 (T35 needs T31, new gyms need T32) |

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

### T12 · Bug fixes (size: M) ✅ done

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

### T13 · Storage box: let creatures go, sort and filter (size: S–M) ✅ done

The box (team panel, `ui.js` `refreshPanel` / `monCard`) is one long unsorted list and has no
way to remove creatures.

- **Let go:** a "Let go" button on box cards only (never on team cards, so the team can't
  be emptied). It asks first, in big, kid-friendly words: "Say goodbye to Flicker (Lv 12)? It goes back
  to the wild." with "Yes, let it go" / "Keep it". Can't be undone. The Creature Book keeps it as
  caught (the Book's `caught` list is never shrunk). Show a short toast afterwards.
- **Sort:** buttons for Newest (default; shows the newest catch first, i.e. the box order reversed), Level, Name and Type. The sort is only for
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

### T14 · Night gyms: the Comet Gym at night, alien-looking Saucer people (size: S–M) ✅ done

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

## Waves 7 and 8 · Five new types: Time, Camo, Cyber, then Cozy and Treasure

Agreed with the owner on 2026-10-13 to 2026-10-15 (a long design talk; this section is the
result, so the conversation isn't needed). Each new type has **its own special way to be found**
and its own gym. **Wave 7** adds the three types that mostly extend what the game already does
(Time, Camo, Cyber). **Wave 8** adds the two that bring whole new systems (homes, minable treasure
blocks): Cozy and Treasure. After wave 7 there are 26 types and 25 gyms; after wave 8, 28 and 27.

**Written before T15 (cleanup) lands:** T15 moves code between files (gym placement out of
`world.js`, the guide and other UI out of `main.js`) and adds test helpers. Names below describe
*what* to change, not where it lives today; planners read the code as it is when they start.

**Rules for both waves** (on top of CLAUDE.md):
- **Old worlds stay as they are.** The old 224×224 area is block-for-block the same as before
  (`old-saves` proves it; its checksums only change where a task says so). No old gym, cave, the
  tower or a build moves. New gyms go **only in the new land** (T17).
- **Keep it simple, keep it object-oriented.** The owner pushed back on special cases ("too many
  exceptions"). Prefer one general rule, or one general class with data-driven variants, over
  one-off code paths. Things that must stay open for later: gym access (T16), creature spawn
  conditions (T18), homes (T22: wave 9 may add Grass/Rock/... homes as data only).
- **7 creatures per new type, like every other type: three families that evolve once, plus one
  that doesn't.** Every family gets its **own body shape**. The owner wants variety: no more
  frogs, turtles, owls, crabs, chicks (the game has plenty); living objects are welcome. Names
  are proposals; the planner checks they are original.
- **Gyms: 2 trainers + a leader**, like every other gym. Each new gym is harder than the last,
  the last ones quite hard. Levels in release order: **Time 31–33, Camo 34–36, Cyber 37–40
  (4 creatures)**, then **Cozy 41–43, Treasure 44–46**. (Asked on 2026-10-16: the owner
  keeps these levels.)
- **The Champion's Tower needs every badge** (25 after wave 7, 27 after wave 8), with **no
  exception for players who were already Champion** (today old Champions keep access; the
  owner decided to drop that). Old saves keep their badges and Champion title. The Tower's
  people get stronger in each wave so it stays harder than the last gym (about 42–45 after wave
  7, about 48–50 after wave 8).
- Original names only, short child-friendly text, works on iPad (touch) as well as desktop.

| Wave | Tasks | Why together |
| --- | --- | --- |
| 7a | T16 Guide cleanup (gym access objects) · T17 Bigger map + protected gyms · T18 Three new types (Time, Camo, Cyber) | Guide/UI vs. world generation vs. species/shapes/fx/spawns |
| 7b ✅ | T19 Clock Tower, Hidden Hill and Firewall Maze gyms + Tower at 25 | Needs T16's access objects, T17's new land and T18's types |
| 7.5 ✅ | T19.5 Book wiki links | Small UI task (book.js, ui.js) between waves 7 and 8 |
| 8a | T20 Treasure blocks · T21 Two new types (Cozy, Treasure) | World/blocks vs. species data |
| 8b | T22 Homes (Doormat, home types, meter, preview) | Needs T20's blocks and T21's creatures |
| 8c | T23 Cozy and Treasure gyms + Tower at 27 | Needs T22's homes (the Cozy Gym lives in one) |

---

## Wave 7 · Time, Camo, Cyber

### T16 · Guide cleanup: gym access objects (size: M, first)

Today the guide (arrow, hints, welcome and "closed" toasts) is one function with a growing list of
special cases: night gyms, sky gyms (Cloud, Saucer), cave gyms (Fossil, Goo). Every new gym kind
adds another `if`. Before adding three more gyms, turn it into **one small object per kind of
access**, so the guide itself has no gym-specific code:
- Each gym gets an **access** object built from its def. It answers the same few questions:
  *where should the arrow point* (given the player's position), *what hint to show* (on the way,
  when near), *is it open now* and *what to say when it's closed*.
- Keep **where** (surface, cave, sky; later hidden, home, ...) and **when** (always, night only;
  later by time of day) as separate small pieces, combined per gym, so the Saucer Gym is simply
  "sky + night", not its own case.
- The guide asks the next unbeaten gym's access object and shows the answer. Nothing else.
- **Behaviour stays exactly the same** for all 22 gyms and the tower (arrow targets, texts, the
  sky pad tips, the cave stairway path, the night note). This is a refactor.

Done when: the guide has no gym-kind checks left, `new-gyms`, `new-gyms-access`, `gym`,
`champion` and `old-saves` pass unchanged, and a test-only access kind can be added without
touching the guide.

### T17 · Bigger map and protected gyms (size: L)

**1. The map grows to 288×288: 64 new blocks on the east (+x) and south (+z) sides.**
- The old map keeps its coordinates (x, z 0–223), so builds and edits line up. Saves already
  record `size`; old sizes are converted the same way as the earlier 192 → 224 growth.
- Terrain comes from noise at absolute x/z, so it simply continues into the new land. **But every
  calculation that today looks at "the whole map"** (height percentiles for mountains/snow/peaks,
  gym/tower/cave-gym spot searches, cave carving, plants, keep-outs, map-edge rules) **must keep
  using exactly the old 224×224 area** for old content, or biomes and gyms in old worlds would
  shift. The planner lists every such place. The new land gets its own pass (biomes from the same
  rules, plants, small caves optional) that only writes outside the old area.
- **New gyms (T19, T23) are placed only in the new land**, so they can never land on old builds.
  The planner reserves room for 5 gyms there (3 now, 2 in wave 8) so wave 8 never moves wave 7's.
- The **start point stays where it is** (today it is the middle of the map, which would move).
- The seam at x/z = 224 should look natural (no wall, no step); whatever happens at today's edge
  (water, cliffs) now happens at the new edge. Check screenshots on a few seeds.
- **Measure load time and memory** on the slow renderer and with an iPad-sized viewport before
  and after (the owner's son plays on an iPad). If it gets much slower, say so in the plan.
- Bump `WORLD_VERSION`; multiplayer guests get the bigger world.

**2. Gyms can't be broken into.** One rule for every gym (all 22 today plus the new ones):
blocks inside a gym's building/area can't be broken, and blocks can't be placed there. Building
*outside* a gym stays allowed (the Cloud/Saucer pads need pillars; wave 8's Treasure roof key
needs a way up). Each gym's protected box comes from the same place as its other data (cave gyms
include their cavern, sky gyms their island). A short toast: "Gym walls are too strong to break!"

Done when: `map` and `old-saves` pass (old area unchanged), a new spec checks the seam, the start
point and gym protection (break/place inside fails, outside works), load time noted in the plan.

### T18 · Three new types: Time, Camo, Cyber (size: L)

Like T9: type colours, effectiveness, moves (own moves + a few signature moves with `fx`, using
the existing effect kinds only), `TRAVEL`/`IMPACT`/`FX_COLORS` and an `fx:<type>` sound, wool
colours (gym roofs), README tables, Book filters. Roster: 23 → 26 types × 7. **No new battle
mechanics** (the owner said no to "scan"/"copy-paste" ideas).

**Spawn conditions as data.** Each new type has its own way to be found. Express these as a
small set of spawn conditions on the spawn entries (like today's `day`/`night`), not as code
paths per type: a time window (Time), a disguise (Camo), "two players close together" (Cyber).
The spawn tests and roster spec allow types with no plain biome spawns via that same data.

#### ⏰ Time: clocks and hourglasses, only at sunrise and sunset
- **Found only in two short "golden hour" windows a day: dawn and dusk, about 1 minute each**
  (a full day is 8 minutes). Dawn and dusk have different creatures. When a window opens, the
  sky is already orange and a soft *tick-tock* sound plays (no text).

| Family | Before | After evolving | When |
| --- | --- | --- | --- |
| 1 | **Flipsand**: a little hourglass that flips itself over to move | **Sandtimer**: a tall hourglass with arms, sand swirling inside | dawn |
| 2 | **Pendulo**: a metronome hopping on one leg, ticking side to side | **Grandtock**: a big grandfather clock that walks slowly | dusk |
| 3 | **Ringaling**: an alarm clock with two bells for ears | **Clangalarm**: a huge alarm clock that stomps on hammer legs | dawn |
| Single | **Twilorb**: a slowly spinning ball, half sun and half moon | | dusk |

- Moves (existing effect kinds): **Rewind** (heal), **Snooze** (sleep), **Fast Forward** (priority).
- Matchups: strong vs **Metal** (rust), **Paper** (old paper crumbles), **Slime** (dries up);
  weak to **Cosmic** (space bends time) and **Bug** (a bug in the clockwork).

#### 🍃 Camo: things that look exactly like a block
- **They look exactly like the local block** (leaves in forests, sand on beaches and deserts,
  stone in mountains and caves, snow in snowy places) and **never move**. After a while they
  quietly leave, so they don't pile up.
- **The only tell: a blink, about twice a minute.** No wiggle, no sound, no marker. Looking
  straight at one shows its name tag (as for any creature). Hit or tap it to battle; it pops out
  into its real shape.
- **It's a creature drawn as a block, not a world block:** it never changes the world, nothing is
  saved or sent to the other player. One rule for the whole type ("Camo creatures wear a
  disguise"); wave 7's Hidden Hill Gym trainers use the same rule.

| Family | Before | After evolving | Disguise |
| --- | --- | --- | --- |
| 1 | **Bushling**: a leaf block with a sleepy face | **Topiphant**: a big hedge trimmed into an elephant | leaves (forests) |
| 2 | **Castlet**: a sand block with a tiny flag on top | **Fortsand**: a walking sandcastle with towers | sand (beaches, deserts) |
| 3 | **Cubble**: a cobblestone with a hidden mouth | **Statuo**: a stone statue that only moves when you're not looking | stone (mountains, caves) |
| Single | **Igloop**: a snow block that's secretly a tiny igloo with a door | | snow |

- Evolved forms are bigger (2×2 blocks).
- Matchups: strong vs **Bug** (sneaks up on it) and **Mind** (can't read where it is); weak to
  **Light** (gets spotted) and **Sound** (an echo finds it); resists **Normal**.

#### 💻 Cyber: pixels, screens and glitches, only when playing together
- **Found only when two players are in the same world and within ~30 blocks of each other**,
  and even then uncommon (about 1 in 15 spawns, at most one at a time). Each player has their own
  wild creatures, as today.

| Family | Before | After evolving |
| --- | --- | --- |
| 1 | **Pixbit**: a pixel blob | **Pixbit 2.0** |
| 2 | **Clickit**: a mouse cursor with legs | **Clickit 2.0** |
| 3 | **Wifly**: a butterfly with Wi-Fi wings | **Wifly 2.0** |
| Single | **Error 404**: a small glitchy ghost | |

- Evolutions keep the name and add "2.0" (the owner likes this); 1.0 looks blockier, 2.0 sharper.
- Matchups: strong vs **Metal**, **Mind**, **Paper** ("going paperless"); weak to **Water**
  (shorts out) and **Bug** (computer bugs!); resists **Electric**. (Wave 8 adds Cozy beats Cyber
  and Cyber beats Treasure.)

Done when: roster (26 × 7), fx and sound specs pass; screenshots of all 21 creatures reviewed
(Camo both disguised and popped out); the type chart has the matchups; a spec covers each spawn
condition (a Time creature only in its window, a Camo creature as a still block that blinks and
starts a battle when hit, a Cyber creature only with two players close, via `openPair`).

### T19 · Three new gyms and the Tower at 25 badges (size: L)

All three are in T17's new land, protected by T17's rule, and plug into T16's access objects
(no new checks in the guide). Each has 2 trainers, a leader, a badge, a wool roof colour and
dialogue, like the other gyms.

- **Time: the Clock Tower (31–33).** A tall tower with a **giant clock face** on the front showing
  the game's time. Its floors' doors open at **different times of day**: trainer 1's floor in the
  morning, trainer 2's in the afternoon, the leader at the top at night. Climbing it takes one
  in-game day; the big clock shows when the next door opens. (Optional: a huge sundial outside
  whose shadow points to the open door.) Access = surface + "open by time of day" (a T16 piece).
- **Camo: the Hidden Hill (34–36).** From outside it looks like a **natural grassy hill** made of
  the same blocks as the land around it, with a couple of trees on top. The only giveaway is a
  **door hidden behind a bush**. Inside it's a normal gym; the 2 trainers stand **disguised as
  stone pillars** with the same blink rule as wild Camo creatures; the leader waits at the back.
  **The guide arrow leads to the area but fades out about 20 blocks away**, with "It's hidden
  somewhere around here…" (a "hidden" access kind in T16's system).
- **Cyber: the Firewall Maze (37–40, 4 creatures).** Three rooms, each a maze of **red and blue
  laser walls** (floor to ceiling, glowing). Stepping on a red switch turns red walls off and blue
  walls on, and the other way round. Each room is a bit harder; trainer 1 after room 1, trainer 2
  after room 2, the leader in the "server room" after room 3. No punishment: walls only block, and
  a **reset button** at each room's door puts the room back. An optional co-op shortcut switch
  needs one player to stand on it while the other walks through (never required). T17's
  protection makes the walls unbreakable and stops building over them.
- **Champion's Tower:** needs **all 25 badges**, no exception for old Champions; its people get
  stronger (about levels 42–45).

Done when: the gym spec beats all three (the Clock Tower's doors open at their times, the Hidden
Hill found and its disguised trainers battled, the maze solved with switches), the Tower refuses
with 22 badges and battles with 25, and `old-saves`, `champion`, `new-gyms`, `multiplayer` pass.
README (gyms, types) and CLAUDE.md updated.

---

## Wave 8 · Cozy and Treasure: homes and treasure blocks

Two types found **only near a home the player builds**. Both need new systems (homes, blocks you
can only mine), so they have their own wave after wave 7.

### T20 · Treasure blocks you can only mine (size: M)

**Done** (plan in `plans/T20.md`): treasure in cave walls and deep stone of the old area and the new land (only stone changed;
`old-saves` counts treasure as stone), limited blocks with counts, natural-only cubes from gold ore and leaves, spec `treasure`.

- **Three new blocks: Sunstone (warm shining gold), Ruby (red), Sapphire (blue)**, with their own
  names and textures, clearly different from Gold Ore and Star Crystal (those stay free in the
  Blocks panel, as today).
- Found in the world: in cave walls and deep under hills, rare. The planner decides whether old
  worlds get them underground in stone (no visible surface change, `old-saves` checksum updated
  on purpose) or only the new land plus its caves.
- **You collect the block itself:** breaking one adds 1 to your count; placing one uses 1. The
  Blocks panel shows them with a count ("Ruby ×3") and greys them out at 0. All other blocks stay
  unlimited. Counts are saved per player (new optional save field; old saves start at 0). Built
  as a general "limited block" property, so more can be added later.
- **Fix:** breaking a **placed** Gold Ore can give a Capture Cube, so place-and-break farms cubes.
  Only natural gold ore should give cubes. (Small; may be done earlier as a bug fix.)

Done when: a spec mines, places, saves and loads treasure blocks (count goes up and down, greyed
at 0), placed gold ore never gives cubes, `old-saves` passes.

### T21 · Two new types: Cozy and Treasure (size: L)

**Done** (plan in `plans/T21.md`; Chandelia became Lustrelle and Pillowool became Pillowlamb).

Like T18 (colours, effectiveness, moves, fx, sound, wool, README, Book). Roster: 26 → 28 types.

The owner calls the Treasure creatures "shiny creatures", but "shiny" is a Pokémon term, so the
**type is named Treasure**; its creatures **sparkle all the time** (a small twinkle on the model,
cheap on the slow renderer) and are **rare**.

| Type | Family 1 | Family 2 | Family 3 | Single |
| --- | --- | --- | --- | --- |
| **Cozy** (no teapots: soft, sleepy, warm) | Snugbun (bunny rolled in a blanket) → Quiltbun (quilt cape) | Purrmit (kitten in a mitten) → Knitcat (cat in a knitted sweater) | Pillowlamb (sheep made of pillows) → Dozeram (sleepy ram, pillow horns) | Snoozebear (bear in pyjamas and slippers) |
| **Treasure** (gold/gem colours, sparkling, not always animals) | Coinlet (a rolling gold coin) → Kingcoin (coin stack with a crown) | Crystafox (crystal fur) → Prismfox (fur that throws rainbows) | Ringlet (floating ring, gem eye) → Crownguard (walking crown, gem armour) | Lustrelle (floating glittering chandelier) |

**Matchups the owner approved:**
- Triangle with wave 7's Cyber: **Cozy beats Cyber** (put the screens away and cuddle), **Cyber
  beats Treasure** (a hacker cracks the safe), **Treasure beats Cozy** (bling outshines a blanket).
- Cozy: strong vs **Ice** (warms it up) and **Ghost** (nothing is scary at home); weak to **Bug**
  (moths eat wool) and **Toxic**; resists **Ice**.
- Treasure: strong vs **Drake** (distracted by gold) and **Pixie**; weak to **Slime** (gunk) and
  **Toxic** (tarnish); resists **Normal**.

**Where they appear:** never in biome tables; only near a finished home of that type (T22), as a
spawn condition in T18's system ("near a home of type X"). At most one at a time per home. Cozy
a bit more often in the evening and with 5 hearts. Treasure rare even at a treasure home (roughly
one every few in-game days; planner tunes).

Done when: roster (28 × 7), fx and sound specs pass, screenshots of all 14 creatures reviewed,
matchups in the type chart.

### T22 · Homes: Doormat, home types, meter, preview (size: L)

**Done** (plan in `plans/T22.md`; the meter and red glow show within 24 blocks of your home, eight wool colours are placeable for rugs).

**The design (owner-approved):**
- **Doormat:** a new free block. **One per player** (placing a new one moves your home). In
  play-together each player can have one; homes and their creatures work for everyone, but the
  Cozy Gym (T23) only moves into the **world owner's** home.
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
- **Treasure home:** a home with at least **10 treasure blocks** (T20) in its walls or floor; a
  gem counter on the meter ("6/10").
- **Guidance without lots of text** (the owner asked for this):
  - Standing on the Doormat shows a row of **icons** (walls, roof, size: tick or cross; then the
    type's features as pictures that light up, with hearts or a gem counter).
  - **Gaps in the walls or roof glow red** while you stand on the Doormat; a too-small room shows
    its floor outline. You see where to put a block.
  - A **"Show me a house" button** opens a small panel with a **slowly spinning 3D model** of an
    example home of the chosen type (drag to turn, pinch/scroll to zoom). Features you are still
    missing **blink** on the model. (No ghost blocks in the world and no example house built in
    the world; the owner said no to both.)

**Object-oriented, so a later wave can add homes as data only** (the owner wants Grass, Rock, ...
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
- Later note: types that already live in the wild would come *more often* (or rarer ones) at
  their home; decide then.

**Save:** the Doormat is a normal block edit; the chosen home type is saved per player (optional
field, old saves have no home). Re-check a home when blocks near it change (not every frame).

Done when: a `homes` spec builds a cozy and a treasure home from block lists (on a platform, like
the other specs), checks every rule (too small, open roof, no door, two gaps, not enough wood,
2 of 5 features) with the meter's icons, sees a cozy/treasure creature appear, and checks a
test-only extra `HomeType` works with no other code changes; touch spec covers the chooser and
the preview; screenshots of the meter, red glow and spinning model reviewed.

### T23 · Cozy and Treasure gyms and the Tower at 27 badges (size: L)

**Done** (plan in `plans/T23.md`).

Both plug into T16's access objects ("home" and "keys" access kinds); Treasure is in T17's new
land (its reserved spot) and protected by T17's rule.

- **Cozy Gym: the leader moves in (41–43).** No building. Once the world owner has a finished cozy
  home **and has caught 3 cozy creatures**, the leader and their assistant knock on the door and
  move in: they stand inside the home and battle like any gym (assistant first, then leader; the
  gym has 2 trainers like the others, so the planner places the second one too). If the home stops
  being cozy (someone breaks the bed), they say "Brr, it's chilly in here, can you fix it?" and
  won't battle until it's cozy again. If the Doormat moves, they move with it. The guide points
  home once they have moved in, and before that says what to do (build a cozy home / catch 3 cozy
  creatures). This is `gymMovesIn` on the Cozy `HomeType`, not a special case in the gym list.
- **Treasure Gym: three golden keys (44–46).** A vault building with a locked vault door; the
  leader and trainers are inside. Three **Key Chests** (one new block, a gold chest that gives a
  key when opened, like the cave chests) hidden in three places that need three different skills:
  1. **Dig:** a gold **X** on the ground near the gym; the chest is about 10 blocks down through
     stone.
  2. **Build:** on the **roof** of the tall vault (about 14 up); you build your own way up from
     outside (the roof itself is protected, so you can't dig through it).
  3. **Explore:** in a cave near the gym, at the end of a tunnel.
  Keys are **per player** (a Key Chest opened by one player still gives the other player theirs).
  **A subtle key compass:** near the gym only, a small key icon on the HUD glints faster as you
  get closer to a key you haven't found. No map and no other hints (the owner said so). Not easy,
  but never "lost": all three within ~40 blocks of the gym. No mimic chests.
- **Champion's Tower:** needs **all 27 badges**; its people get stronger (about levels 48–50).

Done when: the gym spec beats both (the Cozy Gym in a test home, including the "chilly" refusal;
the three keys found and the vault opened), the Tower refuses with 25 badges and battles with 27,
and `old-saves`, `champion`, `new-gyms`, `multiplayer` pass. README (gyms, homes, types) and
CLAUDE.md updated.

---

## Wave 8.5 · Firewall Maze bug fix (owner report, 2026-10-17)

### T23.5 · A way out of the Firewall Maze (size: S)

**Done:** a live exit door in the server room's side wall (`EXIT_AT`, opened per player with `setLive` for the badge holder or anyone in the server room), `solveRoom(..., { back: true })` and the `firewall-maze` exit checks. The world's blocks did not change (no `WORLD_VERSION` bump).

**The bug:** after beating Leader Ada the owner was stuck in the maze. `solveRoom` (and the
`firewall-maze` spec) only checks each laser room from its entry (row 0) to its exit (row 8); nobody
checked walking back. Walking backwards alone, **room 2 and room 3 are traps** in every laser state
(room 1 is fine in the state you leave it in): in room 3 you come back in with blue on, the only red
switch you can reach changes nothing, and the blue switch is behind a blue laser. Only the purple
friend lane gets you out, and only while another player stands on a purple pad of that room (either
pad counts, so a visitor standing next to you works). Reloading doesn't help (lasers reset to red on,
still stuck) and the gym is protected, so blocks can't be broken. The only solo way out is losing a
battle (back to spawn).

**Fix:**
- **An exit in the server room** back to the front of the gym (outside the maze), so nobody walks
  back through the rooms. It must not be a way **in** that skips the rooms: e.g. a door in the outer
  wall that opens (`setLive`, per player, like the Clock Tower doors) only for a player who has
  beaten the leader or is standing inside the server room, or an exit pad in the server room that
  moves you to the front door. Kid-friendly wording on it ("Exit" sign / toast "This way out!").
  Its blocks stay inside the slot box and `protect`; if the building's blocks change, bump
  `WORLD_VERSION` and re-measure what `old-saves`/`big-map` check.
- **A backwards check in the spec:** `solveRoom` (or a helper next to it) also walks every room from
  the exit row to the entry row; the spec asserts the player can always leave the gym alone from
  any reachable spot (through the new exit or backwards), so a trap like this can't come back.
- The rooms stay as they are (still solvable forwards alone with 1/2/3 presses, no trap).

Done when: `firewall-maze` has the backwards/exit check and a test that beats the leader and walks
out alone; `big-map`, `old-saves` and `gym` pass. README gym list mentions the exit if it changes how
the gym is played. Do it before S1 (backlog; both touch `MazeLive`).

---

## Wave 9 · More fun: battles with real choices, and more to collect (owner request, 2026-10-17)

After wave 8.5. Battle tasks change battle rules, so bump `duel.js` `VERSION` once for the wave
(both players need the new version) and keep the duel draw order rule (same random draws on both sides).
Keep the Book's move words short and child-readable; the AI (`battle.js` move scoring) must learn the new kinds.

### T24 · Battle fixes: multi-hit 1–5, a Snooze that is worth it (size: S, first) — DONE

- **Multi-hit moves** (Seed Volley, Rivet Shot, Meteor Shower, Bone Toss, Confetti, Rapid Click, Pillow Fight,
  Gem Toss) hit **1 to 5 times** instead of 2–4, weighted so 2–3 stay most common (e.g. 1: 10%, 2: 30%, 3: 30%,
  4: 20%, 5: 10%). Thousand Cranes (signature) stays 3–5. Book: "hits 1 to 5 times". AI expected hits stays 3.
- **Sleep:** today Snooze costs your turn and the foe loses one: a draw. New rule: a sleeping creature sleeps
  **2–3 turns** (drawn when it falls asleep), takes **+25% damage** while asleep, and wakes early if hit by a
  multi-hit move's 3rd hit (so moves combine). Catching a sleeping creature stays easier. Sleep moves can't
  work on a creature that just woke up (one free turn), so no endless sleep-lock.
- Done when: `moves` covers both rules; `pvp` passes with the new `VERSION`.

### T25 · Big-decision moves: team effects with a price (size: L) — DONE (plan `plans/T25.md`: 61 moves in 7 kinds, team state in battles, 5 fx status recipes, 8 `kind:*` sounds)

New moves with a clear upside and a real price or a low chance, so the player has to think. Seven **kinds**
(the mechanic, `fx.kind`, one handler each in `battle.js`); every move gets **its own name fitting its type**
(never the kind's name), and **each type gets only 2-3 of the kinds** (not every type has every kind):

| Kind | What it does | The price |
| --- | --- | --- |
| `rally` | Whole team (bench too) +1 attack until the battle ends | User's defense −2 |
| `shield` | Whole team takes 30% less damage for 3 turns | User can't attack next turn |
| `risky` | 50%: triple damage | 50%: it hits yourself instead |
| `sacrifice` | User faints; the next creature comes in fully healed and +1 attack | You lose a creature for this battle |
| `curse` | Foe's whole team −1 speed (bench too) | Only 40% chance to work |
| `field` | 5 turns: one type does +50% (for both sides) | Helps the foe too if they share the type |
| `lastword` | Very strong hit | Only usable below 1/4 HP |

Pick kinds by feel per type (e.g. Sound: `rally` "Battle Song" + `curse` "Screech"; Cozy: `shield`
"Group Hug" + `sacrifice` "Tuck In"; Treasure: `risky` "Jackpot" + `field` "Gold Rush"; Fire: `risky`
"Wild Blaze" + `lastword` "Last Ember"...). The plan writes the full 28-type table first (2-3 each,
every kind used by several types, names original and child-friendly, no Pokémon terms) for the owner to
check before building. Learned around levels 20-35. Each move needs an fx recipe (`fxrecipes.js`), Book
text, an AI rule (when the AI uses it), and only late gyms get a few (gyms stay easy).
Done when: a new `big-moves` spec checks every kind (incl. bench effects and both sides of a duel);
`moves`/`fx`/`book`/`pvp` pass.

### T26 · Traits: the logic only, first trait Rideable (size: S–M) — DONE

The owner's son didn't like personalities (stat changes), so **no stat traits**. Build only the general part,
so later plans can add traits as data:
- A data list `TRAITS` (id, short child-friendly text, which species can have it, how often). Each creature has a
  `traits` list (often empty). Traits change nothing in battle; whatever a trait does is coded by the feature that
  uses it (riding reads `rideable`), never in the trait list itself.
- **First and only trait now: Rideable** (for T27). Only species where riding makes sense can have it (big land,
  water or sky shapes; the plan lists them), and only some creatures of those species do, so finding one is a small
  hunt. Later candidates (not now): Curious (wild ones walk towards you), anything a future plan needs.
- **Old saves:** a creature without `traits` gets them drawn from its `uid` (fall back to species + level + index),
  so the same creature always gets the same traits on every device; then it is saved. Wild and trainer creatures too.
- Shown as a small badge on the team/box card ("Can be ridden"), nothing more. Duels send `traits` with the team
  (no battle effect, so no `VERSION` bump needed for traits alone).
Done when: a `traits` spec covers old saves (same result twice, saved after), only allowed species getting Rideable,
the card badge, and a visitor seeing the same traits.

### T27 · Riding (size: L, after T26) — DONE

Creatures with the **Rideable** trait (only species where it makes sense: big land, water or sky
shapes; the plan lists them) can be ridden. Ride from the team screen or a "Ride" button (touch too).
- **Land**: faster walking, a higher jump. **Water**: swim on the surface at walking speed. **Sky**:
  fly low (a height cap above the ground; never over gym roofs: `protect` boxes stay protected).
- The rider sits on the model; visitors see it (the avatar message carries the ride). Get off with the
  same button; a battle gets you off. Wild creatures still notice you.
Done when: a `riding` spec covers getting on/off, each kind of ride, gym protection and a visitor
seeing it; `touch` and `multiplayer` pass.

### T28 · Gym rematches that get harder (size: M) — DONE (plan `T28.md`)

After you have a gym's badge, its leader offers a **rematch**. Every win makes the next rematch harder
(levels up a few each time, a fuller team, later the new T25 moves), per player, with a prize (cubes, XP).
Saved as a win count per gym. The first, badge battle stays as easy as now. Done when: `gym` covers a
rematch, the level going up after a win, and old saves (no count = 0).

### T29 · Champion missions (size: L) — DONE (plan `T29.md`: missions, treasure maps, build challenges, rare blocks 75-77, co-op giant battles)

After becoming Champion, the Champion in the tower gives **missions** (one at a time, a list of done ones):
- **Treasure maps:** a map piece with a picture clue ("by the big lake, near a red flower") leads to a dig
  spot with a rare reward. Spots come from the seed, so they are the same for everyone in that world.
- **Build challenges:** a task like "build a tower 6 high with a lamp on top"; checked with the room finder
  ideas from homes (`roomfinder.js`-style checks as data).
- **Co-op boss:** two players together battle one big boss creature (two against one); needs play together.
Done when: a `missions` spec covers each mission kind (the co-op boss via `openPair`).

### T30 · Hide and seek (size: M) — DONE (plan `T30.md`)

A play-together game: one player hides (a 60-second head start, the seeker's screen goes dark), the seeker
gets a hot/cold compass (like the key compass). Found = touch or tap the hider. Rounds swap roles; a
small score. Camo creatures nearby may "help" by being decoys. Done when: a `hide-seek` spec via
`openPair` plays a round.

### T30.5 · Homes are every type they qualify for — DONE (plan plans/T30.5.md) (size: M, after wave 9)

Owner request, 2026-10-17. Today you pick ONE type on the Doormat, and switching from Cozy to Treasure makes the
Cozy Gym's people shiver ("Brr"), which a child can't connect to the menu choice. New rule: **there is no type to
pick. A home is every type it qualifies for, worked out from the blocks.** A gem-studded wooden cabin is cozy AND
treasure at once. One Doormat, one home, no switching.

**Keep it data-driven** (ROADMAP wave 10 rules): nothing outside `hometypes.js` and the `HOME_SPAWN` table may name
"cozy" or "treasure". If wave 9 added more home types (Grass/Rock/... as data), they must just work too. Two types
whose rules clash (e.g. two "mostly X walls" rules) simply can't both be met. That's fine, not a special case.
If T29 (build challenges) moved or extended the feature helpers (`hasBlock`/`atLeast`/`mostly`), use the result,
don't duplicate them.

**1. Home record and result (`homes.js`)**
- The record no longer has a chosen `type`. On load, ignore an old `type` field. Don't write it any more. `gyms`,
  `owner`, `name`, x/y/z stay as they are.
- `home.check(world)` evaluates EVERY `HOME_TYPES` entry: `home.results = { [typeId]: evaluate(report) }`,
  `home.types` = ids whose result is `finished`, in `HOME_TYPES` order. Helpers: `home.is(typeId)`,
  `home.resultOf(typeId)`. `finished` (any type) and `full` (per type, through `resultOf`) replace the
  single-type getters; `homeType`/`result` go away (grep every use: homes, homeui, homegym, access, creatures, tests).
- `homes.ready()` = homes with at least one type.
- `homes.choose()` and the "chooser opens when you step on a new mat" path go away. Stepping on a new Doormat
  (yours, or an orphan) just makes it your home: `claim(x, y, z)` (one home per owner as now, the old mat ->
  Planks as now) and opens the home panel.
- Toasts per type change: when a type becomes true: "Your home is cozy now! Cozy creatures may come to visit." /
  "Your home is a treasure home now! ✨" (words from the HomeType: add a short `doneText`/`lostText` field). When one
  stops: "Your home is not cozy any more. Stand on the Doormat to see what is missing." Only for your own home,
  only when near it (as now).
- Play together: no change to the `home` message apart from the missing `type`. Every browser works out the types
  itself from the same world blocks, so there is nothing to keep in sync. No `WORLD_VERSION` bump needed (no
  world blocks change).

**2. Treasure type (`hometypes.js`)**
- Gems count in **walls, floor AND roof/ceiling**: `where: ['wall', 'floor', 'roof']`.
- Minimum **15 gems** (was 10). Measured: a world has ~600-1,100 gems, ~120-330 visible in cave walls, so 15 is
  one or two caves of mining. Keep the number in ONE place.
- Note for the meter: gems in the walls count against the Cozy rule "walls mostly wood" (50%). With ~80 wall
  blocks in a small house that is fine up to ~40 gems; the meter's wood counter already shows it. No special code.

**3. More gems = treasure creatures come more often (`spawnrules.js`)**
- Today the treasure share is 1/1500 per spawn attempt (one every 0.6 s, so about 15 minutes near the home on
  average). New: every gem above the minimum makes it a bit more likely:
  odds = 1 in `max(300, 1500 - 40 * (gems - 15))` -> 15 gems ≈ 15 min, 25 ≈ 11 min, 35 ≈ 7 min, 45+ ≈ 3 min.
- As data, not an `if`: a `HOME_SPAWN` entry may have `bonus: { feature: 'gems', step: 40, best: 300 }`
  (meaning: each `have` above `need` of that feature takes `step` off the "1 in N", never below `best`).
  `CONDITIONS.home.share` applies it generically (the home object passed to conditions gives `resultOf(type)`).
  Cozy keeps its evening/full multipliers.
- `CONDITIONS.home.ok` = `home.is(type)`; `full` = `home.resultOf(type).full`. Update the fake homes in the
  `two-types` spec to the new shape.

**4. Cozy Gym (`homegym.js`, `access.js`)**
- `homeGymState`: `ofType` = `home.is(cozy type)`; `ready` = that. Nothing else changes: the gym still moves in
  after 3 cozy creatures, `gyms` on the record stays sticky, and "Brr" now only happens when the home really stops
  being cozy (e.g. too many gems replaced the wood, the bed was broken), never because of a menu.

**5. Home panel and meter (`homeui.js`)**
- The meter shows the room checks (walls, roof, size) once, then one line per type that has started (any feature
  or rule `have` > 0), or that is done: Cozy as hearts, Treasure as a gem counter "💎 12/15". A type with nothing
  started stays off the meter (no clutter for a child).
- The panel's 'choose' view becomes **"What can my home be?"**: every type with its blurb, its progress
  (hearts/counter, ✅ when done) and its own **Show me a house** button (the existing preview, per type). No
  "Change home type" button.
- Red gaps and the floor outline don't change (they are room checks, not type checks).

**6. Sparkle on treasure homes (only if small)**
- A HomeType may have `sparkle: true` (Treasure does). A home that `is` such a type gets one small sparkle effect:
  reuse `sparkleGeometry` (shapes.js) / the creature sparkle's look, ~10 twinkling points on inside cells next to
  the walls (from `report.inside`), ONE draw call per home, only for homes within 32 blocks, removed when the type
  stops or the home is gone. Never a world block, never saved or sent.
- If this turns out bigger than ~60 lines, skip it and note it in the backlog instead.

**7. Old saves**
- Homes are re-checked on load and become whatever they qualify for. An old "Treasure home" with 10-14 gems is not
  treasure until it has 15 (the meter shows 💎 12/15, no extra toast). An old Cozy home stays cozy, and its Cozy Gym
  stays moved in.

**8. Book, README, CLAUDE.md**
- Book row for treasure creatures: "Near a home with 15+ gems" (from the condition's `text`, no type check).
- README "Homes": no choosing; a home can be cozy and treasure at once; more gems = more treasure visitors.
- CLAUDE.md: update the Homes (T22) and Cozy Gym (T23) notes (`types`/`is`/`resultOf`, no `choose`, `bonus`).

**Done when:** `homes` covers: a home that is cozy and treasure at once; no chooser on a new mat (it is claimed and
the panel opens); gems in the roof count; 14 gems = not treasure, 15 = treasure; the per-type toasts; an old save
with `type: 'treasure'` and `type: 'cozy'` loads into the right types; a test-only type added with `addHomeType`
works next to the others. `two-types` checks the spawn odds at 15 / 25 / 45+ gems (1500 / 1100 / 300). `gym`
(cozyGym part: a cozy home with gems keeps the gym; breaking the bed makes them shiver; fixing it says "Ahh, cozy
again") and `multiplayer` (Cozy part: a visitor sees the same types without any `type` in the message) pass.
`touch` passes (the panel on a tablet).

---

## Wave 10 · Foundations for new types: realms and room for more gyms (planned 2026-10-17)

Both are careful, world-level work; do them before wave 11. Same rules as T17: old saves keep every block,
gym and build where it was.

### T31 · Realms: another place you can go to and come back from (size: L, careful) ✅ done (plans/T31.md: a bare-bones Dream realm, reached from your cozy home's Bed at night)

A **realm** is a small separate world (own seed-made terrain, e.g. 64x64, own spawn tables, own gyms) that you
travel to and back from, like going into a cave but not inside this world. Built once and general, so later
portals or parallel worlds are just new realms. Dream (T35) is the first user.
- Only one place is loaded at a time: entering unloads the big world, leaving loads it again (short loading moment).
- Travel saves where you were and puts you back there; the save records which place you are in.
- Each realm has its own creatures (`SPAWNS` table per realm) and its own gyms (`protect` as usual).
- Play together: you see a friend only when you are both in the same place; the host's world still owns its realms.
- Never changes the main world (`old-saves`/`big-map` checksums unchanged).
Done when: a `realms` spec covers going there and back, save/load inside a realm, two browsers in the same and in
different places, and the main world unchanged.

### T32 · More room for gyms in the main world (size: L, careful) ✅

Done (`plans/T32.md`): the map grew south only, to 288 x 368 (an 80-row strip; 5 slots in 64 rows were dry only 85% of the
time), five new gym slots 5-9 (`southSlots()`, dry ones first), treasure map spots pinned, `WORLD_VERSION` 12. Wave 11 gyms
use `slot: 5..7`; 8, 9 and T17's 3 stay spare.


New worldly gyms (Food, Squad, Parkour...) belong in the main world, not in realms. The new land has only one spare
gym slot, so grow the map once more the T17 way: old area block for block the same, a new ring of land, a new list of
gym slots (terrain only, never changes once set). **Be cautious about speed:** measure load time, frame rate and draw
calls before and after (desktop and emulated iPad) and keep them about the same (fog culling, chunk budget); grow only
as much as the planned gyms need.
Done when: `big-map` covers the new ring and slots, old saves are unchanged, and the before/after numbers are in the plan.

## Wave 11 · New types: Food, Squad, Dream, Parkour ✅ (done: plans `wave11.md`, `T33`-`T36`)

Shared cost for each type (data, not systems): 7 creatures with at least 3 new shapes, chart row and column, moves,
wool, fx + sound, Book, README. Battle rules stay the same for all; a type only leans towards some T25 move kinds.

**Gym order and levels** (owner OK, 2026-10-20): every new gym's leader is about 2 levels above the one before:
Treasure Vault ~46, then **Food ~48, Squad ~50, Parkour ~52, Dream ~54**; then the Champion's Tower, `REMATCH_CAP` and
Coach Dex move up so the Tower is always above the hardest gym.

### T33 · 🍎 Food (custom code: low)
- **Creatures: funny dishes with faces** (owner, 2026-10-20): e.g. sushi, a hamburger, spaghetti. No tie-in to the
  Restaurant needed. Avoid what exists: Cuppix (teacup), Slime's gummy/jelly shapes, Wobblock (jelly cube), so no
  jelly creature (the old placeholder Jellywob is dropped).
- **Spawn: near where their ingredients come from** = the normal biome tables (e.g. sushi by water, a burger on the
  plains): no new spawn condition (cheaper than "near the Restaurant", which would need one). Behaviour: none.
- Battle (Claude's call): leans to healing and **rally** ("sharing a meal" lifts the team); Cozy already has the
  comfy heal (Hot Cocoa), so Food's heals should feel like eating (a bite, a feast), not resting.
- **Gym, the Restaurant** (owner, 2026-10-20; keep custom code small: three new pieces, everything else reused):
  - **Trainers:** two normal trainers like every other gym (dressed as waiters / line cooks: names and colours only).
  - **Customers:** fixed NPCs at tables, one line each. No logic beyond "you are holding the right dish".
  - **The Chef (the special part):** talking to the Chef gives the order: "Table 2 wants Berry Pie! I need 🫐 🍄 ❄️."
    The order comes from a customer, so the Chef names the table.
  - **Ingredients = the Treasure Vault's `keys`:** a found ingredient is `'<gymId>:berry'` in `game.keys` (per player,
    saved, `loadKeys`). No new save field, no counting, nothing used up. **New piece 1:** while an order is open,
    breaking a natural block of the right kind anywhere gives the ingredient (one check in `breakBlock`, next to the
    "natural blocks give cubes" check; toast "🫐 You found a berry!"). Ingredients come from different places, so an
    order sends you exploring: e.g. 🫐 berry from forest leaves, 🍄 glowcap from caves, ❄️ snow from the peaks
    (ice cream), 🌵 cactus fruit from the desert. **No fish** (the game has no fishing).
  - **New piece 2: the pot,** one live object (`gymLive`, about the size of `VaultLive`). With all ingredients the pot
    (drawn with `setLive`) cycles raw -> golden -> burnt over a few seconds; tap it while golden. Wide window (easy);
    burnt = try again, ingredients are kept. Reaction timing is new in the game (the Clock Tower is time of day).
  - **Serve:** talk to the customer while holding the finished dish; their happy line opens the Chef battle.
  - **New piece 3: a menu table** (`{ name, table, ingredients, time }`, harder dishes have a shorter golden window).
    The badge order is the first dish; **each T28 rematch is the next dish**, so the Restaurant changes per visit;
    ingredients already found still count.
  - Slot 5 (the south slot nearest the start, T32).

### T34 · Squad (was "Swarm"; custom code: low)
Owner, 2026-10-20: "Swarm" read as Bug (🐝, insects, a honeycomb Hive, and "Hive Gym" is already the Bug gym's name), and
groups of fish/birds/pebbles/embers repeat what the game has. Chosen instead (over Clone and Snap): **Squad, lots of little
ones making one big one**, like "three kids in a trench coat".
- **Creatures:** each is a small crew standing on each other's shoulders to make one body; every family has its own crew
  member and its own stack (tower, pyramid, wobbly column), so the roster's 3+ shapes per type come from 3+ member designs.
  Evolving = a taller stack, more members. Names and emoji still open (not insects, not existing animals/elements).
- **Battle:** one **general optional species field** `weakensWithHp` (read like `legendary`/`disguise`, never a type
  check): its attack power shrinks with its HP, so multi-hit moves are great against it. Same on both sides of a duel
  (`VERSION` bump).
- **You see it:** members fall off from the top as it gets hurt; at low HP one nervous little guy is left. No guidance
  needed: every hit knocks one off, a multi-hit knocks off several.
- **Code shape (no new exceptions):** a `stack` shape builder in `shapes.js` fills `parts.members` (bottom to top), like
  every shape fills `legs`/`wings`/`spin`; one generic `setModelHealth(group, frac)` hides members from the top when
  `parts.members` exists (no-op otherwise), called for every creature where the HP bar updates; one more loop in
  `animateModel` for the tumble (time-based, like the sparkle). **Do not** add it the way the Treasure sparkle is
  (`if (sp.type === ...)` in `buildModel`).
- Spawn: normal biome tables. Behaviour: none beyond the model.
- **Gym:** a plain building with tiered trainer spots (a human pyramid you take apart one battle at a time); no live
  parts. Name open (not "Hive"). Slot 6 (T32).

### T35 · 🌙 Dream (custom code: low-medium, after T31)
Owner, 2026-10-20. **Falling asleep belongs to Cozy and Ghost** (Snoozle, Slumbergeist, Pillowlamb, Dozeram, Snoozebear;
sleep moves are already Pixie, Sound, Time and Cozy). **Dream is what you see once asleep: wide awake and odd.**
- **Creatures:** must also look right in the normal world (they can be caught and brought home), so nothing that needs
  dream physics. "Mixed-up" is not enough (normal creatures already are, e.g. Bonzoise); they must be **wackier**, and
  the type gets one wacky dreamy look. Old placeholder names (Pillowmoth, Starsheep) are dropped: they overlap Cozy.
  **Chosen (owner saw prototypes, 2026-10-20; screenshots + model code in `plans/wave11-prototypes/`: `dream-*.png`,
  builders `headstander`, `toddler`, `balloonhead` in `proto.html`, a starting point for the shape builders):**
  - **Type look: "held together by nothing":** every Dream creature's parts (head, body, legs, ears, tail) float a little
    apart (gap ~0.15) and each bobs on its own. Code: a generic `parts.drift` list filled by the shape builders + one loop
    in `animateModel` (no type check).
  - **The head-stander:** walks on its head, upside-down face (smile above the eyes), paws waving in the air.
  - **The toddler drawing:** everything in the wrong place, crayon colours: eyes on two mismatched ear stalks, mouth on
    top of its head, a foot where an arm should be, a hand as one foot, scribbles on the body.
  - **The balloon-head (friendly):** its head is a balloon on a string tied to a bow on top of its body; the body has
    its own happy face on its tummy (a "headless" body was too scary for a kid), one arm waving.
  - Dropped after prototypes: back-to-front (only reads while moving), shadow-swap (a bit spooky), sideways (didn't read).
    Don't repeat existing ideas (something inside the body: Galaxor, Wobblock; long legs: Tallipod; an island on its
    back: Bonzoise).
- **Spawn: only in the Dream realm** (its own `spawns` table). No "near a Bed" condition (Cozy already spawns near homes).
  So Dream creatures are caught only by dreaming.
- **Battle:** its own two type moves like every type, nothing special, **no sleep focus**. The look and the realm are
  its identity.
- **The realm, bigger and wackier:**
  - **Size 256 x 256** (owner: "bigger if cheap"). Only one place is loaded at a time, so it costs less than the main map
    (288 x 368 x 48); measure the "Dreaming..." load with `tests/perf.mjs` and fall back to 192 if it is slow.
  - **Reset Dream edits once** (T31 left "Dream decides its own reset"): old edits are indexed for 64 x 64 and the
    terrain changes anyway. A realm-def version so `cleanRealmEdits` drops older edits.
  - **Gravity is a property of the place:** the realm def gets `gravity` (e.g. 0.5) and `Player` asks the world for it
    (default 1), never "if in the dream". **Moon jumps everywhere in the Dream** (one number, simpler than zones).
    No upside-down gravity (camera and collision would need a rewrite).
  - **Bounce blocks** that launch you up to the next island: one new block + one check in `Player`.
  - Wackier terrain (all data in `TERRAINS`): floating islands at different heights joined by bounce blocks, trees
    hanging under the islands, a checkerboard meadow, giant everyday things, odd colours.
- **The gym is inside the realm** (realms have no gyms yet: placing a gym in a realm world, its people and its badge is
  the main new code). It has a **healer**, placed statically like Healer Hana in the main world (realms have none today;
  walking home to heal would cost the night).
  - **Wacky building with a twist, little custom logic** (owner). Proposed: an **upside-down house** floating above the
    island, roof at the bottom; you get in by a bounce block up through a door in its floor; inside, the furniture
    hangs from the ceiling. The twist reuses the bounce blocks (no new live logic). **Owner: yes.**
  - **Always harder than the previous gym** (owner rule): its leader is about +2 levels over the top level of the gym
    before it (e.g. the gym before tops out at 55 -> Dream leader ~57), trainers a little below. **Knock-on:** wave 11
    puts four gyms above the Treasure Vault (leader ~46), so the Champion's Tower (guards 47-50, Champion 49-52, Zenithar 52),
    `REMATCH_CAP` (55) and Coach Dex **move up** (owner: yes) so the Tower always stays above the hardest gym; set the
    numbers in wave 11 once the four gyms' levels are known.
- **Names** (creatures, moves, leader, gym): Claude picks original, fitting names (owner, 2026-10-20). Terrain layout,
  where the gym / healer / Wake Stone go, and new block ids (from 79) are Claude's call too.
- **Nights stay the normal length** (about 4 minutes of an 8-minute day; no realm time scale: fewer exceptions).
  It stays calm because: the morning never wakes you during a battle (gym or wild; `realms.update` already skips
  `inBattle`), beaten trainers stay beaten (`beaten` is saved), so the gym can take a few nights. **A moon on the HUD**
  that slowly sets instead of a countdown; a friendly morning toast ("Good morning! The gym will wait for you tonight.").
  Losing still wakes you in your bed (T31).

### T36 · 🤸 Parkour (custom code: medium)
- **Start from the mechanic** (owner, 2026-10-20): Parkour creatures are **athletic, agile and lean**, not just "they run
  away". The old placeholders Flipfrog and Springbun are dropped: three frogs (Sproutle, Hopfold, Frogami) and three
  bunnies (Hopsy, Moonhop, Lunaroo) already hop; the boxing kangaroo and the chameleon also exist.
  **Chosen (owner saw prototypes, 2026-10-20; "animals the most"; screenshots + model code in `plans/wave11-prototypes/`:
  `parkour-*.png`, builders `lemur`, `ferret`, `vaulter`, `stickrunner` in `proto.html`):**
  - **Type look: sport gear:** every Parkour creature wears a sweatband headband and sneakers, has long thin limbs and
    stands in an action pose (crouch, mid-stride, mid-leap). Just boxes in the shape builders, no new code.
  - **The slackline lemur:** balancing on one foot with arms out, a striped tail longer than its body.
  - **The ferret:** a long lean body stretched out mid-leap, front paws reaching, back legs pushing off (a curled
    mid-flip pose did not read).
  - **The pole-vaulter:** lanky, a race number on its chest, holding a pole. Keep the pole short or upright so it
    doesn't stick far out of the battle view or through blocks.
  - **The stick-runner** as the single-stage 7th: a stick figure mid-sprint; give it a creature face (ears, a snout)
    so it doesn't read as a little person.
- Spawn: on high places (treetops, roofs, pillar tops): a condition + a `place` rule (homes already have `place`). Owner: OK.
- **Behaviour:** wild ones hop away from you over blocks, so you chase them: one new "run away" walk style (Racer could
  reuse it later with a "run" style). No separate prototype: build it and the owner says after playing if it's not fun.
  Kid-friendly defaults: it hops a few blocks at a time (never off a cliff or into water), **gets tired after ~3 hops**
  and sits panting, and touching it starts the battle (like a Camo creature).
- **Gym, the Obstacle Course** (the clearest part): jumps and narrow beams; **falling sends you back to the start**
  (owner: fine, his son plays games like that); **checkpoints if the course is long** (a small `gymLive` check);
  trainers on the landings. Moving platforms only if cheap.

## Echo Gym makeover: a dance-off ✅ done (owner, 2026-10-21; `src/dancefloor.js`, spec `dance`)

Leader Melody starts a "copy my steps" dance-off on four coloured pads before her battle (2, 3, then 4 steps; a wrong
step just shows the round again). A rematch starts with a longer dance. The pads are drawn with `setLive` on the old
building, so no world block changed; badges, the beaten trainer and rematch wins of existing players stay. Other old
plain gyms could get a makeover the same way later.

## The plan from here: three chapters (owner, 2026-10-24)

The story is in `STORY.md`. **Chapter 1** = our world: 32 gyms and badges, then the Champion's Tower. **Chapter 2** =
the Swirl: Champion missions that never end, and the **Picture Worlds** behind the Swirl's frames, which lead to the
Wizard (they are **not gyms** and give **no badges**). **Chapter 3** = the Scribble (outline at the end).

**Dropped types** (the son did not like them): Magnet, Digger, Builder, Mirror. **Music** too: Sound already exists
(its gym got the dance-off makeover instead, see above). Knight is in the backlog (it could become a Picture World).

Every new gym or place should be something you **do** (riding was the big hit: moving around beats more puzzles).
New types keep the shared cost from wave 11: 7 creatures, 3+ new shapes, chart, moves, wool, fx + sound, Book, README.

# Chapter 1 · Our world

## Wave 12 · Ninja, the 32nd and last gym of our world (owner, 2026-10-24) ✅ done (T37, `plans/T37.md`)

- **Badges: an 8 x 4 grid** at the top of the screen (32 = every gym of our world; the Dream counts). The
  Champion's Tower needs those 32 and never grows again. Old Champions keep their title as now (`game.champion`).
- **🥷 Ninja creatures** blink from spot to spot and throw leaves. In the wild: a new gait `'blink'` in `GAITS`
  (creatures.js, like Parkour's `hopaway`): when you come close fast they vanish in a puff and reappear a few blocks
  away; walk up slowly (no sprinting) and you can reach them.
- **The gym: the Shadow Dojo** (main world, south slot 8; slot 9 stays spare). A walled garden at dusk with paper
  lanterns, a dojo hall and a pagoda; the leader waits on the pagoda roof. It must be **really fun**, so it is about
  sneaking, never a fail:
  - **Watchers:** trainers walk set paths with a lantern; its light cone on the floor shows where they look. Caught in
    the light = "Spotted!" and a puff of smoke puts you back at the last lantern you passed (no lost progress).
  - **Sneak up from behind** and tap a watcher: a battle where your creature moves first ("Surprise attack!").
    Spotted watchers still battle you normally, so sneaking is a bonus, not a must.
  - **Hiding spots:** tall grass, paper screens, barrels: inside one you can't be seen.
  - **Squeaky floor:** golden "nightingale" boards squeak when you run on them and turn nearby watchers towards
    the noise; walk and they stay quiet. Tatami mats are always quiet.
  - **Rooftops:** a second way along the roofs and beams for kids who like jumping more than sneaking.
- **Objects, not special cases:** the Dojo is data plus small reusable classes (in the style of `access.js`
  pieces and `HomeType`): a `Watcher` (path, speed, cone; `sees(pos)`), a `Hideout` (box; `hides(pos)`), floor kinds
  (`quiet`, `squeak`) and a `Checkpoint` lantern. `DojoLive` (`LIVE.dojo`) only wires them together, so other gyms or
  Picture Worlds can reuse watchers and hiding spots later. Lanterns and cones drawn with `setLive` / glow blocks.
- Tests: a `dojo` spec (paths, cones, hiding, squeak, back to the lantern, sneak-attack first move, iPad; no smoke-puff button, owner 2026-10-24).

# Chapter 2 · The Swirl

## Wave 13 · The way in (owner, 2026-10-24) ✅ done (T38a Portal Door + the Swirl, T38b realms together, T38c missions that never end; `plans/T38.md`). T38d (a more atmospheric Swirl, `plans/T38d.md`) follows.

- **The Portal Door:** a big, bright, glowing door **right next to the Champion's Tower door**, so nobody has to
  search for it. Before the Champion title it is dim and says so kindly ("Only a Champion can open this door. Win
  in the tower first!"); after it, it swirls and takes you to the Swirl (any time, alone or with a friend; back
  through the same door). It changes blocks beside the tower, so check it against player builds there (it must sit
  inside a new protected box) and bump `WORLD_VERSION`.
- **The Swirl** (a realm, T31 code): a purple sky, floating platforms, rivers that run upwards, looping stairs,
  frames hanging in the air (one per Picture World; frames whose world does not exist yet are covered with cloth), and
  far out the Wizard's tower with an empty row of stepping-stone spots for the star bridge.
- **Realms together** (moved here from wave 15): a friend can follow you through the door and into the Dream, so
  father and son can play every place together. Without it a realm place is solo.
- **Missions that never end.** Today `MISSIONS` has 12 hand-written ones. After them, a mission maker builds new ones
  from templates (treasure map, build challenge, giant, and maybe new kinds: catch a creature of a type, beat a
  rematch, find a rare creature), with the details drawn from the mission number and the seed, so every device gets
  the same next mission and old saves keep their place in the list. Treasure maps then need more spots than the five
  `treasureSpots`: a new spot list after the old five, never moving those. Giants grow a little with each round.
- **Chapter 2's places are not gyms: they are Picture Worlds** (owner, 2026-10-24; "rift" was too hard a word for a
  7-year-old). Each one is free to explore and ends with a **Boss**; beating the Boss wins that world's **star** (with
  a short note from the Wizard). Each star becomes one glowing stepping stone of the **star bridge** to the Wizard's
  tower (one thing, not a journal page plus a bridge piece). The HUD shows stars, not more badge squares. The owner fixed the numbers
  (2026-10-25, changed 2026-10-26): **12 stars, every one from a Picture World**, 11 frames (framed Picture Worlds; five are placeholder
  `secret1`..`secret5` still to be named; `secret1` will be Doodle, wave 15), 12 bridge stones (the eleven plus Portal, whose house is in
  the Swirl, no frame). **The Wizard gives no star** (owner 2026-10-26): beating him is chapter 2's championship (see wave 16). Their levels
  sit above the Champion; `REMATCH_CAP` and Coach Dex are checked against the new top.

## Wave 13.5 · Where to go, one-button answers, a calmer tablet screen (owner, 2026-10-25; plan `plans/T39.md`) ✅ done (T39a-c)

- **Choose where to go:** tap or click the guide line (or press G): big rows for the next gym, any gym, the Champion's Tower,
  the Portal Door, your home, a friend, the current mission, and in realms the way home. Places that are meant to be found
  keep their own rules (the arrow only brings you near Hidden Hill; food ingredients, vault keys and treasure spots are never
  destinations). Object-oriented: a `Destination` per kind with a `help` level (`full` / `near` / `none`).
- **One-button answers:** the button that asks also says yes (E / Enter / the action button / a click), Esc or N says no;
  a fresh press is needed, so holding E never answers by accident; questions from another player wait a second.
- **A calmer tablet screen:** one big action button that says what it will do, Place / Ride / Down only when useful, a
  smaller top bar (☰ and Book); nothing lost.

## Wave 14 · Picture Worlds 1: the Giant House, the Pirate Seas, Playland ✅ done (T40 base + T40a-d, `plans/T40.md`-`T40d.md`; owner questions left open: the Wizard's note words, the ladybug, Boss rematch rewards)

- **🐜 Tiny, the Giant House:** very small creatures (ants, a ladybug, a thimble mouse, a dust bunny, a seed) hiding
  in small places (in flowers, under a leaf, in a cup). The house is built from normal blocks at giant scale (nothing
  shrinks in code). Not a jump course like Parkour: no falling penalty, several ways through, and the giant things
  **do something**: a fan whose wind lifts you to a shelf, a toy train you ride (press the giant remote), a tap that
  makes a river you float down on a bottle cap, a sleeping cat to tiptoe past (running wakes it a bit: wait, never a
  fail; can reuse the Dojo's `Watcher`), a mouse hole and a keyhole as secret ways, crumbs for bonus cubes, the Boss
  on a giant cookie on the table.
- **🏴‍☠️ Pirate, the Pirate Seas:** a parrot captain, a crab with a hook claw, a ship in a bottle, an octopus with a
  spyglass. Open sea and islands; a cannon shoots you from island to island, swing on ropes, board Captain Squawk's
  ship (ships and cannons, not digging like Treasure).
- **Playland** (one flat world for three places, the third in wave 15):
  - **🏎️ Racer:** dashes away in straight lines (Parkour's run-away walk, "run" style); fast but fragile. A race
    against the Boss around a track (new NPC path code).
  - **⚽ Ball:** the creatures are balls. A football pitch and a basketball court; score to win. Needs a ball that
    rolls and bounces (new physics); probably the biggest place so far.

## Wave 14.5 · Room for more blocks, and the Wizard's star (owner, 2026-10-26) ✅ done

- **The block atlas is a grid** (`ATLAS_COLS` 32 wide, as many rows as needed: 512 x 112 px today, room for 1024 tiles in a 512 x 512
  grid). It was one row of 16 px tiles, 256 at most (4096 px, the widest texture many tablets take), and wave 14 left 222 used.
  Every tile is drawn exactly as before (checked pixel for pixel); the few places that find a tile in the atlas go through
  `tileX` / `tileY` / `tileUv` / `tileGlY` in `blocks.js`; the Swirl tint's shader gets the tile number back from the uv. Still one
  texture and the same draw calls. New tiles are added as before (`MORE_TILES`).
- **The Wizard gives no star** (owner 2026-10-26): the 12th star is a fifth secret Picture World (`secret5`, it took the `wizard`
  entry's place: no save could hold that star). The Swirl (version 4) has 11 frames (the new one, N5, at the west end of the north
  gallery, which grew by 8) and 12 bridge stones; the Wizard's island moved 6 east (x 142). Old Swirl edits are dropped once.

## Wave 15 · Picture Worlds 2: Portal, the Fair, Surprise, Doodle, Atlantis ✅ done (T41-T45, `plans/wave15.md`, `T41`-`T45`; owner 2026-10-27 reworks: the Room of Doors' Piñata Party and Jack Catch, Doodle's Draw! (you steer the pencil, Rubber chases), eight Portal House rooms in the spirit of Valve's Portal, harder Funfair rounds, a hand-drawn Sketchbook look; 9 of the 12 stars now have a world: `secret3`-`secret5` are still to be named)

- **🌀 Portal:** the Portal **type** and its Picture World, not the Portal Door (that is built: T38a, it only leads into
  the Swirl). Creatures that pop in and out of swirls (a doorway with legs, a rabbit that jumps into its own hat).
  The Portal House in the Swirl itself: a chain of portal rooms to the Boss (teleports are cheap).
- **🎡 Funfair ("lunapark"), in Playland:** a carousel horse, a candy-floss sheep, a balloon-animal dog, a walking
  ticket. Trampolines, a carousel, bumper cars and a roller-coaster ride to the Boss.
- **🎁 Surprise** (moved from our world into the Swirl, 2026-10-24): gift boxes, a jack-in-the-box, a piñata; every
  wild one starts as a box and you only see what it is when it opens. The Room of Doors, every door a surprise (a
  slide, a ball pit, a confetti room, a trainer).
- **✏️ Doodle, the Sketchbook** (owner, 2026-10-25; was the Wizard's tower's name, now a Picture World of its own):
  the same blocks and cubes as everywhere, but drawn in a new art style: monochrome charcoal on paper, almost hand
  drawn and almost unfinished. The world, its creatures and its Boss all look this way. It takes the first placeholder
  frame (`secret1` in `pictureworlds.js` becomes `doodle`: no save can hold that star yet, so the 12 stars stay 12).
  Little custom code, because the look lives in
  textures and the shader, not in new geometry:
  - **A sketch atlas:** a second version of `drawAtlas` (blocks.js): paper tiles with a few charcoal strokes and
    hatching, swapped in for the realm. Block kinds must differ by hatching pattern, not only by shade (readable for a child).
  - **Outlines and hatching in the shared shader:** wobbly, gappy dark lines near block edges (from the position on the
    block face) and hatching where it is darker; one switch next to the Swirl's `swirlTint`, off everywhere else (main
    world, Dream and Swirl stay bit for bit as they are).
  - **Unfinished edges:** paper-white sky and fog, so the far world fades out like a drawing not finished yet.
  - **Boiling lines:** the strokes jump a few times a second like hand-drawn animation (one time uniform; gentle, so it
    never flickers hard).
  - **Creatures, people and the Boss:** one function swaps their materials for a sketch material in the realm (grey
    shading, outlines on the box edges, the same boiling); battles there look sketched too. Doodle creatures still
    get their own shapes and the usual per-type cost (7 creatures, 3+ shapes, chart, moves, wool, fx + sound, Book,
    README), plus a terrain builder and a Boss.
  - Rejected: a full-screen post-processing pass (edge detection + greyscale). Less control and an extra full-screen
    pass on iPads.
- **🔱 Atlantis, the Sunken City (T41, `plans/T41.md`; owner 2026-10-27)**: its own type and star, in the **Pirate Seas**,
  which grow east to 320 x 224 (every island stays where it is; old Pirate Seas edits are converted, not dropped). Open from
  the start: a whirlpool east of Palm Key, or its own frame (`secret2` becomes `atlantis`, "Pirate Seas · Atlantis"). A
  glowing crater 11 blocks deep with a dark sunken city. **The skill game (the owner wants skill, not puzzles): Glowfish
  Catch.** Swim freely in 3D (where you look, kicks for bursts, only in the crater), hold **Catch!** to coil and let go
  to **lunge** with a net (judge the distance). Three districts, three tricks: shy fish pop out of jars (reaction),
  darters must be herded into dead ends, a golden school is caught many at once when it bunches up. Your catch is your
  light in the dark; 12 lights in three lanterns open the palace dome, and **Queen Coralia** battles for the star (in
  the dry throne room). Type: the city's woken guardians, never fish or crabs: Jarling > Grand Urnling, Statuecub >
  Guardlion (rideable), Tilesnek > Mosaicoil, Runestone; teal rune lines on every model.

## The last three stars: ideas (owner, 2026-10-26 and 2026-10-28; not decided)

Wave 15 gave 9 of the 12 stars a world; `secret3`-`secret5` still need one. Each should have **one new verb** (something
no gym or world asks you to do yet), its own type, creatures, Boss and look. The owner wants skill, not quiet puzzles
(2026-10-27). Candidates, best fit first:
- **⚔️ Knight, the Castle** ✅ built as T49 (`plans/T49-castle.md`, the `secret3` frame, behind `?preview`). Owner 2026-10-28:
  the T49 plan replaces the catapult-aiming idea: Shield Up! (block soft pumpkins and arrows from every side), a hedge maze, the
  Joust on the castle's armoured horse; creatures Pricklet, Visnail, Clipclop and Turrock.
- **🫧 Bubble, the Bath Lagoon** (owner: yes, if it is clearly not Pirate or the Dream). The verb: **make your own way**
  with a bubble wand. Blown bubbles rise slowly and pop after a few seconds; jump on them to climb (big ones slow and
  sturdy, small ones fast and fragile), wind vents push them, thorns pop them. Other ideas: catch an object or a creature
  in a bubble and float it somewhere (a key to a ledge); ride inside a bubble. Boss: a bath-time octopus or soap-bubble
  walrus behind three bubble shields you pop by bouncing your own bubbles into them. Creatures: a rubber duck, a sponge
  crab, a bubble-wand fairy, a fizzing bath bomb.
- **🌍 Cube Planets (gravity)** (replaces the dropped Magnet: the gravity part without the magnets, so not like Metal).
  Little cube-shaped planets in space: walk off an edge and you stand on the side face; jump to the next planet and its
  gravity takes you. Creatures about pull, not stars (Cosmic has those): a comet dog that orbits you, a ringed-planet
  turtle, a little satellite bird. The most expensive idea: the camera and walking must work on any face (the T35 notes
  say no upside-down gravity so far).
- **🪞 Mirror** (maybe: the son did not like Mirror before, so only with a lively version). Your reflection is a second
  you that moves mirrored, and both must reach their pads; or funhouse mirrors that make you tall (jump over walls),
  tiny (squeeze through holes) or wide (push big blocks). The size mirrors could also go into the Funfair.
- **🦖 Dino** (undecided: Bone has fossils, Drake has dragons). To make it its own: **the giants are the land**. Huge
  gentle dinosaurs walk slow loops; jump on a back, ride across a valley, hop to the next tail; the Boss on the biggest.
  Moving things you stand on already exist (the toy train, the bottle cap).
- **🎲 Board Game World** (new, not yet discussed). Roll a big die and walk the spaces of a giant board: a battle, a
  ladder up, a slide down, a mini challenge, bonus cubes; fun taking turns with a friend. Creatures: a dice cube, a
  playing-card bat, a domino snake, a spinner top. The Boss on the last square.
- **🎭 Shadow Theatre** (new, not yet discussed). The whole world is a side-view stage: the camera locks to the side and
  it plays like a 2D platform game, paper cut-out scenery, a spotlight that follows you. Creatures: hand-shadow animals,
  a curtain ghost, a marionette. Boss: the Puppet Master.
- **🔍 Mystery Manor** (new, not yet discussed; fits the story: the star is hidden). Talk to suspects, find clues and
  pick who hid the star (like Guess Who), a new mystery each visit made from the same parts. Little new tech, a lot of
  simple writing.

Not wanted: Snow Globe, Farm (owner, 2026-10-26). Builder went to the backlog (probably chapter 3).

## Wave 16 · The Wizard's Tower and the Custom type (the design option below is still open)

"Doodle" is no longer this wave's name (owner, 2026-10-25: Doodle is a Picture World in wave 15). **The Wizard is chapter 2's
championship** (owner, 2026-10-26): he gives no star (all 12 come from Picture Worlds and are found before you can cross the bridge);
the win is designing your Custom creature and becoming the Wizard's ally. Maybe a title too (like Champion): not decided. The **Custom** type has no
wild creatures: you design yours after beating the **Wizard** at the top of his tower (each floor: copy
a picture with wool blocks, harder going up; the Wizard is +5 levels after every win, reusing the T28 win count).

**Reaching the Wizard: the painting tower** (owner, 2026-10-20). **One game, not one per floor:** every floor is the same
thing, "make the canvas look like the picture", and floors differ only by data, like the Firewall Maze's `ROOMS`.
- **Canvas + easel:** each floor has an easel with a small picture and a canvas, a flat grid of blank wool cells on the
  wall. **Tap/click a canvas cell to paint it** with the colour picked from a row of paint pots (easier on an iPad than
  placing blocks on a wall). The canvas is drawn with `setLive` (never an edit, never saved or sent; the gym stays
  `protect`ed). When it matches, the stairs door opens (like the Vault door). Stuck for a while: the wrong cells blink.
- **One checker** with one extra rule: a target cell may be **free** ("any colour, but all free cells of one group the
  same colour"). Pre-painted cells are just part of the floor's data.
- **Five floors (a floor table):**
  1. **Copy** a 4x4 picture (teaches the controls; the only floor that needs real guidance).
  2. **Bigger:** a 6x6 copy.
  3. **Mirror:** half is pre-painted, you paint the other half as in a mirror.
  4. **Your colour:** "copy it, but the ? parts can be any colour you like" (free cells; the easel shows them as a
     rainbow ? swatch).
  5. **Top, the Wizard's floor:** half a creature is given (mirror) and its parts are free colours: **the colours you
     paint here become your Custom creature's palette**. Then the Wizard battle.
- Guidance: the picture explains itself after floor 1; one short sign per floor ("Pick any colour for the ? parts!").
- No timer, no fail state, no trainers on the landings (the paintings are the challenge; keeps it easy).
- **Left out on purpose** (each would be a second game: new code and new guidance): a from-memory floor (timer, covered
  easel) and a free-rules top floor ("3 colours, same on both sides" needs a second checker and is hard to explain).
- Later, maybe: painting together (each player sees half the picture), needs shared live state like S1.
- **Decided by the story (2026-10-23, 2026-10-24):** the tower stands in the Swirl, reached over the bridge once every
  Picture World's star is found (all 12); beating the Wizard ends chapter 2 (no badge and no star: chapter 2 has no badges and the Wizard gives no star); the creature
  you design is the Swirl's new **guardian** (the floors teach how a creature is designed).
- Open: picture designs, the Wizard's team.

Two options for the design, the owner is still deciding (the painted palette fits option 2: the creature stores a few
wool ids instead of a palette number):
1. **Free design:** a design screen (shape, colours, name, moves), the look saved on the creature and sent in saves,
   duels and play-together, models built from it. High: the look has to travel everywhere.
2. **Ready-made designs + palettes (compromise):** ~6 Custom species with a few part choices and ~12 fixed palettes;
   the creature only stores two small numbers (e.g. `paint: [design, palette]`), like traits. Everything else is
   a normal species, recoloured. Medium.

---

# Chapter 3 · The Scribble (owner, 2026-10-24: direction agreed, to be fleshed out over time)

Story in `STORY.md`: a creature the Wizard once scribbled out and threw away escaped through the crack and scribbles
over the worlds; you are the **Wizard's ally**. Pieces so far:
- **Battling beside the Wizard:** two against one, using the co-op giant battle's `'friend'` side (T29) with the
  Wizard's creature in it.
- **Scribbled zones** appear in places you already know (our world and the Picture Worlds), so old places get new life.
- **Simple crafting** (from the backlog): the Wizard's workshop, e.g. crafting Capture Cubes.
- **Mixing (owner, 2026-10-28; idea):** make your own potions, a magic or chemistry workshop where mixing two or three
  things leads to something cool and fun (a colour change, a bounce, a glow, a tiny creature friend...). Fits chapter 3's
  "making things" side, next to crafting. Not a size-changing potion world (that idea was dropped).
- **Eggs, hatching and raising** (section below): a scribbled creature turned back into an egg; raise it to heal it.
- **Gifts and trading** (section below): some eggs only hatch with a friend's help; presents and trades between friends.
- **The ending:** help the Wizard finish drawing the Scribble, and it becomes a friend.
- Not wanted: more "custom" design features (owner, 2026-10-24).

## Sharing and the world around you (owner, 2026-10-20)

- **Gifts and trading:** give a friend blocks or a Capture Cube (arrives as a present box), and trade creatures
  between players.
- **Dreaming together** (moved to wave 13 as "realms together"): today a guest cannot follow the host into the Dream realm
  (T31 toast), so a visiting friend can't catch Dream creatures or earn that badge; let a guest come along.
- **Photo mode.**
- **More to do in the Dream** (ideas, 2026-10-21, not decided): **a new dream every night** (the island's shape and
  theme change each time you sleep: candy land, upside-down trees, an underwater dream where you breathe fine, a giant
  toy room; built from the night's number so a reload keeps it), **dream rules** (jump higher, float down slowly, fly
  without a creature; gliding already exists from riding), **counting sheep** (catch jumping sheep before morning for a
  wake-up reward), **your creatures talk** (short speech bubbles from your team, only in dreams), **dream blocks** to
  bring home (cotton candy, a floating star block, a glowing cloud; `limited` blocks like the gems), a friendly **"bad
  dream" corner** (a grumpy fog patch with a shy creature that cheers up when you beat it). Best value first: new dream
  every night, dream rules, talking creatures. "Dreaming together" became **"realms together"** (wave 13).
- **Wild creatures grow with your team** (owner request, 2026-10-19): today a wild creature's level comes only from its
  distance to the start (`far / 10` in `creatures.js`) plus +10 after 16 badges; it should also follow your team's
  level so the world stays a challenge.

## Eggs, hatching and raising (owner, 2026-10-20: its own wave, may get complicated)

**Eggs:** found in chests and mission rewards, or left in a cozy home by two creatures of one type; carried in a
team slot and hatched by walking; the baby is special from level 1: the home egg knows one move from a parent (more
once there are more traits). Earlier note: no warmth, no "what it hears", no bond meter (they add special cases all
over the game); "raising" is to be planned when the wave starts.

---

## T19.5 · Creature Book wiki links (size: S)

**Done** (wave 7.5; no separate plan).

- Team and box cards: the creature's name and picture open its Book page, its type chip opens that type's list,
  each move opens the move's page. The Book's Back button then says **‹ Team** and returns there (same scroll).
- Book pages link to each other: move names (move page: what it does, how often it hits, the creatures you have
  seen that learn it and at which level), type chips (the type's list with its strengths and weaknesses),
  "Train a ... to Lv N" names, and a **Yours** line (levels in team and box, "See your team").
- `book.go(view)` / `back()` keep a trail of pages (with scroll); ‹ › on a creature page browse without adding
  Back steps. `book.open({ species | move | type, from: 'team' })`; `ui.openBook(at)` / `ui.backToTeam()`.
- Spec: `book` step 11.

---

## Backlog (later)

Owner likes these, but not now: **home helpers** (creatures left at home do jobs: fire keeps
the fireplace lit, grass grows flowers), **creature helpers** (fire lights lamps, rock digs
faster, sound reveals hidden ore), **simple crafting** (logs → planks, stone → stone bricks, gold → Capture Cubes; now part of chapter 3).
(Gifts, trading, photo mode and growing wild creatures moved to "Sharing", eggs to "Eggs", both under chapter 3; dreaming together is wave 13.)

**Fun ideas** (2026-10-21, after riding was a hit; not decided): **a buddy that follows you** (your lead creature walks,
swims or flies beside you, sits when you stop, tap to pet; friends see it), **traits that do something** (Glider:
jump off a cliff and glide; Glow: lights caves around you; Sniffer: a hot/cold glint towards chests and treasure (use
`Glint`); Digger: breaks blocks faster; the "creature helpers" above as traits), **bouncy and fast blocks** you place
(a Slime bounce block, a speed path, a water-slide current, a jump pad; Player physics only, cheap), **ring courses and
races** (fly or ride through rings against the clock, alone or racing a friend; could be the Racer gym), **riding
together** (a friend sits behind you, or side by side), **hats and costumes** for creatures and the player (could be
what the rare mission blocks buy), **tricks** (teach your buddy a spin or a dance to show off), **events now and then**
(a parade of rare creatures, a shooting-star night, a festival day). Suggested order: buddy, bouncy blocks, more traits.

**Builder, the Construction Site** (owner, 2026-10-26: probably chapter 3, next to crafting): drive a crane, place beams and
build your own bridge to where you need to go; diggers, cranes and cement-mixer creatures. Not a Picture World.

**Types for later** (owner, 2026-10-21; same per-type cost as wave 11; Ninja went to wave 12; Knight could become a Swirl place, the Castle):
- **🏰 Knight** (now T49, the Castle Picture World in the old `secret3` frame: `plans/T49-castle.md`): armoured animals (a hedgehog with a shield, a snail in a helmet, a horse in armour, rideable; a little
  castle with legs). Gym: the Castle: lower the drawbridge, a hedge maze, a **catapult** that launches you over the
  wall, the leader in the throne room.

**Rare mission blocks:** the blocks exist now (T29: Star Block, Rainbow Brick, Giant Trophy, ids 75-77, limited, only from missions);
what they unlock or are used for is still open.
**T32 note:** keep new gyms 12 blocks away from the treasure map spots (`treasureSpots(world)`, T29). Done by construction: the spots are pinned to the 288 x 288 map (z <= 277) and the south slot boxes start at z = 290.

Still open from before (see CLAUDE.md): late gyms need a lot of training; the real Supabase
Realtime path for play-together isn't covered by automated tests.

---

## Backlog wave · Playing together: one shared world (owner request, 2026-10-16; moved out of wave 9 on 2026-10-17)

While playing together, both players should see the same world. Today two things differ per player,
which the owner noticed in the Firewall Maze and with wild creatures. **Not before wave 9 is done.**
No new server: the game has none (GitHub Pages + Supabase saves and Realtime broadcast only), so
**the host's browser is the authority for its world**, the way weather already works (the host sends
its phase, visitors never run the timer). Playing alone must work exactly as now (you are your own host).

### S1 · Shared Firewall Maze lasers (size: S–M, first)

Today `MazeLive` keeps a phase per player and room, so a visitor sees the host walk through red
lasers that are off on the host's screen. Make it **one phase per room per world, owned by the host**:

- Stepping on a switch (anyone) flips that room's lasers for everyone; the reset button resets the
  room for everyone. Visitors send "I stepped on switch X / pressed reset" to the host, the host
  applies it and sends the room phases; a visitor joining gets the current phases with the world.
- A laser must never turn on inside **any** player (`LiveCells` already checks the local player;
  also check `game.mp.others` positions, and stay off until they step out).
- Friend pads keep working as now (they already depend on the other player's position).
- Rooms stay solvable alone (`solveRoom` unchanged). Badges are still per player: everyone beats
  the trainers themselves.

Done when: `firewall-maze` passes, and `multiplayer` (or a new `maze-together` step via `openPair`)
shows a switch pressed by one browser flipping the lasers in both, a laser not turning on inside the
other player, and reset working for both.

### S2 · Shared wild creatures (size: L)

Today every browser spawns and walks its own wild creatures (`creatures.js`, `Math.random()` for
spawns and wandering), so a creature next to a friend on one screen doesn't exist on the other.

- **Only the host spawns**, around every player (it already has their positions; the `together`
  condition uses them). Visitors spawn nothing while in someone's world. The extra work on the
  host's computer for creatures around far-away visitors is accepted (2–3 players).
- **Spawn = one message:** id, species, level, position, and a **path seed**. Wandering is computed
  from that seed + the shared clock (no `Math.random()` in the walk), so every screen gets the same
  path with **no position messages while it walks**. Only events are sent: spawn, battle start,
  battle end, caught / beaten / left.
- **In a battle the creature freezes in place** for everyone (like the player), so two players can
  never battle the same creature. A visitor asks the host to start a battle; the host says yes
  (marks it busy) or no (someone else got there first).
- **Caught or beaten = gone for everyone.**
- **Camo creatures** are dressed by each screen from the world's blocks (`Disguise.pick` is
  deterministic from the world), so both see the same disguise; the host decides where they spawn.
- **Host leaves mid-battle:** the visitor goes home as today, and the battle simply ends.
- Spawn conditions (day/night, golden hour, weather boosts, `together`) are worked out by the host.
  Levels stay per world (the host's `levelBonus`; check what feels fair for a visitor with fewer badges).

Done when: a new `creatures-together` spec (via `openPair`) shows the same creatures at the same
places in both browsers over time, a battle freezing the creature for the other player and refusing
a second battle, a catch removing it in both, and solo play unchanged (`spawn-rules`, `weather`,
`battle-and-menu`, `multiplayer`, `pvp` pass). Bump `duel.js` `VERSION` only if battle rules change;
both players need the new version (say so kindly if a visitor's version is older).
