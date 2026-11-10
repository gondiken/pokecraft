# Chapter 3: where we are (owner and Claude, 2026-11-07 to 2026-11-09)

Only Test A / B (section 6) is in the game, behind `?preview`; the rest of chapter 3 is not built. This file collects every idea, decision and piece of owner feedback from the
first planning session, so a new session can continue without re-asking. The story outline is in `STORY.md` ("Chapter 3: The
Scribble"), the older pieces in `ROADMAP.md` ("Chapter 3 · The Scribble"). The house rules in `CLAUDE.md` still hold, above all
**"easy to understand, hard to master"** and the naive-kid / skilled bots.

## 1. Where it started: the son's flag idea (2026-11-07)

The son's idea: **a flag for each type**, found around the world, that boosts creatures.

Agreed so far:
- **One flag per type** (47 types; Custom is never wild, so maybe 46). No attack / defence / speed versions of each flag.
- **A flag boosts your creatures of that flag's type.**
- **A Flag Book** that lists the flags you found (like the Creature Book).
- **You fly one flag at a time**, chosen from the Flag Book (the son wanted to own them all and pick one; the owner liked finding
  them; both fit: find them, then choose freely among the ones you have).
- **Levels of a flag (bronze / silver / gold): not needed** (owner: "I think that's not needed").
- **Where:** not decided. The owner is unsure about hiding them in the old world. Chapter 3's new land is the likely home.
  Tying them to the Scribble is possible but only once the Scribble is fleshed out.
- Open: how big the boost is (a small one, about +10 %, so gyms stay easy), whether it counts in battles with friends (it would
  change battle rules: a duel `VERSION` bump), and whether it works in live fights, turn-based battles or both.

## 2. The search for chapter 3's big new thing (what was tried and why it was dropped)

The owner wants chapter 3 to be **as new as chapter 2 was compared with chapter 1**, without forgetting the game's roots,
and **very fun**. Chapter 1 = an open world, catching, gyms, badges. Chapter 2 = the Swirl, a hub of handmade Picture Worlds
with skill games, stars, the Wizard.

Claude's starting observation (the owner agreed it found what was missing): **creatures only matter in battle**; with 47 types
nothing in the world cares what type a creature is. Riding was the biggest hit because a creature finally did something.

Ideas in the order they came, and what happened to them:

| Idea | Verdict |
| --- | --- |
| Type powers that open a new land (Fire melts ice walls, etc.) | Dropped: "keys and locks", no real challenge, no story reason. |
| Play as your creature, one movement per type (Racer zooms, Ghost phases, Sound echoes...) | Dropped: clashes with riding (bodies already fly / swim / run: why would a Drake glide when Boomwing flies?), types overlap and one type would solve another's places. The owner still likes the abilities (climbing, digging, tiny) but fears overlap, which already happens with riding. |
| "The body moves, the type battles" (new body kinds as traits, like `rideable`) | Kept as a possible side piece; on its own "quite smaller", not a chapter. |
| **The son's idea: become the creature and use its battle moves** | **The direction.** "How do you even do Supernova?" Answer: every move already has data (power, multi-hit, priority, heal, sleep...) that decides its shape in a live fight; every type already has battle effects and a colour. |

Turn-based alternatives were compared too (the owner plays Draft Showdown and Score! Hero on mobile):
- **Runs with 1-of-3 picks between fights** (Draft Showdown's best idea): offers like a flag, double power, a move upgrade, a borrowed
  Box creature, a heal. Not tested. Could sit around any battle style; makes the Box and the flags matter. Still open.
- Draw the move, Flick and bounce, Aim (sharpshooting with lead), Timing (timed taps): all built in the test arena, see section 3.

## 3. The test arena (built, a separate page, never part of the game)

**https://gondiken.github.io/pokecraft/arena.html** (`arena.html`, `src/arena/`, bots `tests/arenabots.mjs`; see the CLAUDE.md
code map). It reads the team from the browser's save (read only). **Keep it** (owner 2026-11-09: "don't delete the latest tests,
especially live one").

- **⚡ Live (the winner):** real time. Move with the stick / WASD, your creature auto-faces the nearest monster (tap one to pick it;
  this was always so, on purpose for the iPad), four move buttons + Dodge in the five fixed tablet slots (keys **Q E R F** + Space,
  owner: "1-2-3-4 aren't good"), monsters warn in red (a line, a circle where you stand, a ring round a stomper) before they hit.
  Moves become shapes from their data (`shapeOf`: shot, many shots, big blast held to charge, rush, heal, power up, slow cloud, sleepy
  cloud); damage is battle.js's sum with the type chart. A squad of three to swap between (tap, or 1 2 3; each keeps its own HP; the
  next jumps in when one faints). Places: Meadow, **Dark Cave** (you see only near your light; Fire / Light / Electric / Cosmic see
  further; blasts light it up; owner: "there's light difference definitely"), **Ice Lake** (everyone slides about 2 blocks after
  letting go, monsters overshoot; Ice creatures keep their grip). An "8 monsters" button and an fps counter test performance.
  Owner: "Live looks good generally ... my son likes it", "Live is clearly going to be a fun game."
- **⏱️ Timing (kept as a comparison):** the battle menu, but every attack (stop a needle, hit beats, let go of a charge in the green)
  and every block (tap as the ring closes) is a timing tap. Owner: "pretty nice but still nowhere as good as live."
- **Removed:** Draw and Flick ("weird games ... there's no real aim", Draw was nearly a copy of Score! Hero), Aim ("a very basic game").
- Bots: naive (mashes, never moves, taps at random) loses, skilled wins, in every mode and place, Live at 60 and 20 fps.
- Not proven by bots: playing the cave by sight (the bots know where hidden monsters are); the iPad's real frame rate.

**Decision (owner 2026-11-09): all effort goes into Live.**

## 4. The owner's concerns about Live in the real game (the open questions)

The owner is not yet convinced how Live fits the whole game:
- **Where do fights happen?** A boxed arena is "pretty limiting"; the whole open world is "too limitless".
- **When do creatures fight live, and when turn-based?**
- **How many monsters fight us each time?**
- **Do we walk there ourselves with our creatures, or do the creatures go alone?**
- **How do these battles fit the story?**
- **It looks like a different game.** "I don't think I could sell this game this way, it'd be two separate games."

**The owner's own diagnosis (2026-11-09), to keep in mind:** what made Live feel like a spinoff was **only the perspective (the
overhead camera) and the boxed arenas**. It was *not* "being the creature", and the comparison "the game is turn-based battles" is
wrong: the game is far more (exploring, building, riding, homes, gyms with challenges, many skill games, painting, trading).
Chapter 2's very different games (kart, football, bubbles, cube planets, jousting) feel like one game because they happen in
first person in the same world.

## 5. The current answers (proposals, to be tested; not decided)

- **No boxed arena: a fight happens on the real ground where it starts.** A ring about 20 blocks wide is drawn on the ground; the
  terrain is the arena (trees as cover, hills as high ground, water). Every fight differs because the place differs. The twists come
  from the real place: a fight in a real cave is dark, on a frozen lake it is slippery.
- **How it starts (the owner: "actually pretty cool, I'd love to see the test of it"):** you walk in first person as always; you see
  a scribbled patch ahead (grey scribbles, monsters inside); you walk in; **the scribble snaps into a ring around you, your lead
  creature jumps out of its cube, and the camera rises smoothly from your eyes to just behind and above your creature, one
  continuous move, not a cut to another screen.** When the scribble is cleared the ring fades, the colours come back, the camera
  glides back into your eyes and you walk on. (Cube Planets' steady camera, `cubecam.js`, is a precedent for a third-person camera.)
- **How many monsters:** you see it before you go in: the size of the patch says it (a small smudge 2-3, a big tangle 5-6, a dark
  knot with a big one in the middle). You choose when you are ready.
- **Live or turn-based, by the story:** creatures battle because it is how they play (STORY.md): taking turns, fair. **Scribble
  monsters do not play by the rules**, they rush all at once, so your creatures fight live. Catching, gyms, Bosses, duels stay as
  they are; live is for the Scribble's monsters.
- **Where chapter 3 happens:** the owner prefers **a brand-new land** ("the Scribbled Lands" is a working name): patches that get
  tougher deeper in, the chapter's places and bosses, the flags. Patches may also spread into the old world now and then. Beaten
  scribbles could turn back into eggs (STORY.md's eggs).
- **The other perspective (to test too):** live fights in **first person**: you stay in your own eyes, your creature runs beside you,
  you aim with your look like chapter 2's games (Fire!, Kick!, the Swirl Wand), dangers behind you as pointers round the screen
  (`ui.setPointers`, from Shield Up!). Risk: you see less of the field, so fewer monsters and clearer warnings.

Other pieces still on the table for chapter 3 (from STORY.md / ROADMAP.md and this session): the Wizard fighting beside you
(two against two), friends fighting together, the flags, runs with 1-of-3 picks, eggs and raising, crafting / potion mixing, body
abilities (climb, dig, tiny) as exploring extras (never locks), more Live twists: protect an egg, a boss with a weak spot to get
behind, the Wizard's big spell when you herd monsters into his circle, catching live.

## 6. Next steps (owner 2026-11-09: in a new session; nothing built yet)

1. **Keep** `arena.html` (Live and Timing) as it is.
2. **Test A: the transition in the real game.** One scribbled patch inside the actual game, behind `?preview` only, near the start:
   walk up in first person, step in, the ring snaps shut on the real ground, your creature jumps out, the camera rises behind it,
   the Live fight on the real terrain (reuse `src/arena/` rules where they fit: `shapeOf`, `damage`, red warnings, the five fixed
   buttons), the camera glides back down, walk on. Questions it answers: does it feel like the same game? does the real ground work as
   an arena (heights, blocks as cover, water)?
3. **Test B: the same fight in first person**, as a toggle (like Cube Planets' camera: V / the Camera button), so the owner and son can
   feel both perspectives on the same fight.
4. Then decide the camera, and only then plan the land, the flags and the rest.
5. Every test: real keys / touches through the game's own loop, naive vs skilled bots, iPad (stick + five fixed buttons, no new
   buttons), the frame rate shown on a real iPad.

## 7. Test A and Test B (built 2026-11-09, `?preview` only)

`src/scribble.js` (the patch, the camera, the HUD, the buttons) and `src/scribblefight.js` (the Live rules on the real ground, pure);
spec `scribble`, bots `tests/scribblebots.mjs`. Open **https://gondiken.github.io/pokecraft/?preview** and start or continue a game: the
patch appears 14-23 blocks ahead of wherever you are when the game starts, never over anything built (a toast says so). Without `?preview` nothing changes.

- **Test A:** walk in. The knot snaps into a scribbly ring fence (radius 10) on the real ground, a Capture Cube flies from your hand, your
  lead creature hops out, the monsters leap out of the knot into an arc in front of it, and the camera rises from your eyes to behind and
  above your creature in one 1.6 s move. You fight with the arena's Live rules, unchanged (`shapeOf`, `damage`, the red warnings, the
  `LIVE` numbers come straight from `src/arena/`), with three creatures to swap. When it is over the camera glides back down into your
  eyes and you walk on (a won patch scribbles itself back 20 s later once you are away; after a loss walk out and in again).
- **What the real ground does:** a creature steps up one block, never two (a step of two is a wall); shots fly straight and stop in the
  first solid block (hills, trees and houses are cover); a monster's rush stops at a wall, so its red line ends there; a stomp only
  reaches what stands at about its own height (stand on a bump); water is swum slowly. The red warnings lie on the blocks.
- **Test B:** V (or the pause screen's "🎥 Fight" button) switches to first person, also in the middle of a fight (the camera glides).
  You walk yourself, your creature runs beside you, your moves go to the monster you look at, and warnings behind you show as arrows.
- **Controls:** the five fixed tablet slots become Dodge (Jump) and your four moves (the action button, Place, Ride, Down); keys Space
  and Q E R F, 1 2 3 or a tap on a card swaps, a tap on a monster picks it. Behind the creature the stick / WASD move the creature and a
  drag / the mouse turns the camera.
- **Tuning:** scribble monsters have 8x HP, power 60 and strike 30 % more often (`FIGHT.attack` 0.7, the same lever as the arena's Ice
  Lake) than the arena's Live (6x, 50). Found while testing: the arena's bots never got the Power Up bonus (it is set in the arena's
  draw loop, which the bots skip), so mashing was weaker there than in real play. Here buffs work, and with the arena's numbers a mashing
  bot won about half its fights. The monsters leap out of the knot round your creature (one in front, two to the sides); an arc only in
  front let mashing win more. Bots on three worlds (seeds 1, 22, 122), 8 games each: naive loses (1 win in 72), skilled wins all 144,
  behind and in first person, at 60 and 20 fps. Mashing with a lead whose types beat all three monsters (Phantomaw) won about half its
  fights before the faster rhythm and 2 in 24 after: the type chart working, reported by the bots, not failed.
- **Not proven yet:** the real iPad's frame rate (the scene adds about 20-40 draw calls: the tangle is one instanced mesh); whether a child
  reads the red warnings on bumpy ground as easily as on the arena's flat floor; whether 0.7 is too fast for the son on a tablet
  (the arena's 1.0 was fine for him on flat ground).
- **Questions for the owner after playing:** does it feel like the same game? which camera? is the ring the right size on real ground?

### Owner feedback 2026-11-09 (after the first try) and what changed

- "I don't see any pencils / knots anywhere": the patch was placed near the world's start; the owner started near their home. Now it
  appears ahead of you when the game starts, with a toast.
- "Will scribble monsters always look like doodles? I don't like that idea ... adjust lore to the game": no lore change was needed.
  STORY.md already says creatures caught in the Scribble "go grey and grumpy": they are now their real models, greyed, with pencil scribble
  wound round them; beaten, the scribble bursts off, their colours come back and they hop away (a natural lead-in to eggs / catching).
- "Are the rings basically artificial limits?" Yes: the ring is an invisible wall drawn as a scribbly fence (radius 10). Open question for
  the owner; the proposal is to drop the wall: the monsters stay tied to their patch (they never chase you far), you may walk away, and
  going far enough ends the fight (the scribble knots up again). The fight is then bounded by the monsters, not by a fence.
- "This is still just testing, right? Chapter 3 would happen in a new world, with reasons to come back to the old world (flags, other
  creature types to catch)": yes. Test A / B only asks the camera question; the patch near you is a test spot, not where chapter 3 lives.

### Owner feedback 2026-11-09 (second try) and what was measured

- **Ring:** removing it could make winning too easy unless monsters heal when you come back, and leaving by accident would be
  frustrating. Kept for now; still open.
- **Shots beat rushes** ("Graphitan Lv 56 with Rivet Shot won (5+ min), Kitegale Lv 91 and Blazehound Lv 89 fainted fast"). Measured with
  each creature alone (`kid` bot: sees red 0.35 s late, presses every ready move; `skilled` bot), seed 1, before any change: Graphitan kid
  5/6, Kitegale kid 0/6, Blazehound kid 3/6. Two causes: the arena's cool-downs give a shot about 1.5 x its power in damage a second,
  a rush 0.5 x, a big blast 0.2-0.35 x; and a rush stopped right next to the monster, inside its stomp (rushers were hurt mostly by
  stomps). Shorter cool-downs, or a rush that always went through, let the mashing bot win 9-17 of 18. **Built:** a rush that hits a
  monster in the last half of its red warning (when it pulses fastest) cancels its attack ("Stopped!"), knocks it back and carries you
  through to the far side; any other rush stops at the monster as before; the arena's cool-downs stay. Three worlds, alone: skilled
  Kitegale 9/9, Blazehound 9/9, Graphitan 9/9; mashing (team of three) 3/18; the full bot run: naive 3 / 90, skilled 108 / 108.
  So rushers ask for timing (easy to understand, hard to master), shooters do not. A kid who mashes still does better with shots.
- **The big circle** seen round a monster is the stomp warning (radius 3.4, the arena's own); nothing about blasts was changed.
- **Why the arena felt smoother** (compared, not yet changed):

  | | Arena | In the game |
  | --- | --- | --- |
  | Camera | fov 50, 15 blocks away, 62 degrees down, never turns (north is always up, stick up = screen up) | fov 75 (the game's own), 8.5 away, 45 degrees down, turns with your look (forward = away from the camera) |
  | Ground | flat, radius 11 (380 sq blocks), 3 pillars, plain colours | real blocks, radius 10 (314 sq blocks, 17 % less), hills up to 5 high, trees, houses, textures, fog |
  | Steps | none | your creature went up or down a block 60-90 times a minute, each a 1-block pop (now eased) |
  | Warnings | flat red on flat green | red laid on bumpy, textured ground, cut by hills |
  | Draw calls | about 60 | about 330 (the whole world) |

  Ideas to try next, one at a time: the fight camera at the arena's fov 50 and higher; the camera not turning during a fight; a calmer
  patch spot (flatter, fewer trees); a slightly bigger ring.

## 8. Where we left off (end of session 2026-11-09) and the night run

### Done in this session (all behind `?preview`, live on `main`)
- Test A (behind the creature) and Test B (first person, V / the pause screen's "🎥 Fight" button) in the real game: `src/scribble.js`,
  `src/scribblefight.js`, spec `scribble`, bots `tests/scribblebots.mjs` (naive / kid / skilled; `solo`, per-move-kind damage, snaps,
  blocked time). The arena (`arena.html`, `src/arena/`) is untouched and must stay so.
- Owner verdicts: **the camera rising from the eyes is "actually perfect"**; the timed rush is "great work"; monsters must look like the
  real creatures gone grey, never like doodles (done); the patch appears ahead of you (done).
- Balance found and fixed: shots beat rushes (cool-downs and where a rush ends); the timed rush (section 7). Steps now ease.

### Owner decisions for the next session
- **Steeper fight camera: yes** (like the arena: fov about 50, about 62 degrees down, further back). The owner also hopes the ground's
  ruggedness calms a little as the camera steps back (a steeper, further view does that by itself; fog / detail may help).
- The ring: keep it for now (removing it risks easy wins or a frustrating accidental exit). Still open, not urgent.
- Chapter 3 itself will be a **new world** with reasons to return to the old one (flags, catching other types); the patch near you is only a test.
- "I hope other moves that I haven't tried have similar implementation quality": every move kind must get the same treatment the rush got.

### The night run: what to do, in this order (each step: bots naive / kid / skilled on seeds 1, 22, 122 at 60 and 20 fps, the
### `scribble` spec green, screenshots, then commit and push to the session branch, `main` and `claude/clever-ritchie-etj0nq`)
1. **Steeper camera.** Behind-the-creature camera: fov blends from the game's 75 to about 50 with the rise; height / distance like the arena
   (about 13 up, 7 back, scaled for a portrait iPad); keep the one continuous rise from the eyes (pinned screenshots of the move again).
   Try, as separate measured steps, whether the camera should stop turning with your look during a fight (arena: north always up, stick
   up = screen up) and whether a slightly bigger ring (radius 11, the arena's) or a flatter patch spot reads better. Keep what is better,
   write down what was tried. Check walls between camera and creature (the pull-in) still never snap.
2. **Audit every move kind like the rush** (`shapeOf` kinds: bolt, volley, burst, dash (done), heal, buff, cloud, sleep). For each: what it
   does on the real ground, how it reads to a child (one look), damage per second vs its risk, and a creature whose moves are mostly that
   kind played alone by the kid and skilled bots (`play(page, bot, { solo: [species, level] })`). Fix weak or broken kinds with a rule
   that asks for skill (timing, position, aim), never a plain number bump that a masher also gets; the mashing bot must stay below a
   quarter of wins. Known suspects: big blast (held to charge; cool-down 3.2 s, about 0.2-0.35 x power a second), the clouds (slow / sleep:
   do they matter?), heal and buff (mashed, they are free), volley (four small shots: strong at range). Report a table per kind.
3. **Fight length.** The owner's Graphitan fight took 5+ minutes; bots win in 20-50 s. Make a "real kid" bot closer to a person (late,
   imprecise, sometimes wrong target) and aim for about 1-2 minutes for a person; lower the monsters' HP if needed while mashing still
   loses.
4. **Test B (first person) polish**, same checks: aiming with the look, arrows for warnings behind you, the creature beside you.
5. **iPad**: the frame rate cannot be measured here; keep draw calls low (now about 330 in a fight, the arena 60) and say so.
6. Keep `plans/chapter3.md` up to date (a section per step with the numbers), CLAUDE.md's code map rows for scribble.js /
   scribblefight.js, and end with a short list of questions for the owner.

Do not start the new world, flags, eggs or the Wizard beside you yet: the camera and the fight must be right first.
Useful commands: `cd tests && npm install`; `PC_CHROMIUM=/opt/pw-browsers/chromium node run.mjs scribble`
(`SCRIBBLE_ONLY=bots|real|ipad|closed`); `node scribblebots.mjs` (`SCRIBBLE_GAMES`, `SCRIBBLE_SEED`, `SCRIBBLE_TUNE='{"foeHp":7}'`).

## 9. The night run (2026-11-09 night): what changed, with the numbers

Every number here comes from `tests/scribblebots.mjs` (the bots) and `tests/scribblemeasure.mjs` (new: the measurements) on the seeds 1,
22 and 122, all behind `?preview`. The arena (`arena.html`, `src/arena/`) is unchanged.

### Step 1: the steeper fight camera (done)

`FightCam` in `src/scribblefight.js` (pure, so the bots measure exactly what is drawn): **fov 50, 13.5 up and 7 back (about 62 degrees
down) like the arena, further back on a portrait screen** (x `1.2 / aspect`), looking just ahead of your creature. The rise from your eyes
is the same one move (the owner's "actually perfect"); the field of view now glides from the game's 75 to 50 along with it and back to 75
on the way down. Pictures: `plans/chapter3/cam-before-*.jpg` and `cam-after-*.jpg` (`4-rise` and `6-rise` are the same pinned moments of
the rise, `8-fight` the fight, `ipad` the iPad).

What a child sees (`scribblemeasure.mjs cam`: every moment of 24 kid and skilled fights, a point counts when it is inside 95 % of the screen):

| | Monsters on screen | Whole red warning on screen | Your creature | Camera jumps / fight | A block between camera and creature |
| --- | --- | --- | --- | --- | --- |
| First try (fov 75, 8.5 away, 45 degrees), iPad landscape | 84.5 % | 76.7 % | 99.9 % | 0.8 | 1.9 % |
| Steep camera, iPad landscape | **92.3 %** | **87.3 %** | 100 % | 0.1 | 0.1 % |
| First try, iPad portrait | 91.9 % | 87.4 % | 99.9 % | 1.9 | 1.5 % |
| Steep camera, iPad portrait | **96.5 %** | **96.1 %** | 100 % | 0.2 | 0 % |

- **Draw calls in a fight: about 335 -> 113** (a steeper, narrower view sees far less of the world: step 5 for free).
- **The camera does not turn with your look in a fight** (like the arena: stick up = away from the camera, always). Measured as far as a bot
  can: the bots never turn the camera, so a turning one only differs when a person turns it, and a fixed one already shows 92-97 % of the
  monsters. It also means one thumb fewer on the iPad (no drag to turn). Your look waits where it was, so the glide back down ends looking
  the way you came in; V to first person and back re-aims the camera the way you then look.
- **A hill in the way:** the camera tips up toward straight overhead (eased, about 0.3 s), it never pulls in any more. The first version
  pulled in like before and swung up to 1.5 blocks a frame (measured on seed 22, under trees); tipping alone: 0-0.2 jumps a fight (a jump =
  more than 0.6 blocks in 1/60 s), a block in the way 0-0.1 % of the time (a creature right under leaves).
- **Ring radius 11 (the arena's) tried and dropped:** mashing won 2/12 instead of 1/12, monsters on screen fell 96 -> 93 % (landscape),
  the skilled and kid bots were the same. Radius 10 stays.
- **A flatter patch spot: not tried this night** (the steep view already makes the ground look much calmer; see the pictures). Still a
  question for the owner after playing.
- The skilled bot learnt one thing: cornered by hills with a stomp coming (seed 22, about 1 fight in 20), it now dodges through instead of
  standing still (a person would). The fight rules were not changed in this step.

### Step 2: every move kind audited like the rush (done)

**How it was measured** (`node tests/scribblemeasure.mjs kinds`): a squad of three Owlucid (Lv 30, whose moves are neutral against all three
monsters, so the type chart stays out of it), each with **one plain shot (Slime Slam, 75) plus the kind's move**. The yardstick is "two shots"
(plus Bass Blast, 75): *is a slot of this kind worth as much as a second shot?* 8 games x 3 seeds, half at 60 and half at 20 fps, three bots:
naive (mashes), kid (sees red 0.35 s late, walks out, presses what is ready), skilled. Skilled: time to win (lower is better); kid: the
monsters' HP left when its squad falls (lower is better); "hurt": the squad's HP lost a minute. The noise between runs is about +-5 points.

| Kind (example) | On the real ground, in one look | Skilled: time to win, before -> after | Kid: monsters' HP left, before -> after | Masher | What changed |
| --- | --- | --- | --- | --- | --- |
| Two shots (yardstick) | a ball flies straight, a hill stops it | 36.7 s -> 36.2 s | 49 % -> 51 % | loses (best kit for mashing, still 0 wins) | nothing |
| Many shots (Broadside) | four small balls in a fan | 44 s -> 44 s | 55 % -> 64 % (noise) | loses | nothing: worth almost a second shot |
| **Big blast** (Statue Slam) | **was invisible while held**; now a ring grows on the ground round your creature, white when full | **67 s -> 45 s** | **79 % -> 59 %** | its blast does **0** damage (was 5 a second) | the ring; it grows from 2 to 5 blocks; only a full one hits hard (x0.35 -> x2.0 by charge squared); a blast that catches a monster in the last half of its warning **stops** it like the timed rush; the charge counts toward the cool-down |
| Rush (Swashbuckle) | the timed rush of section 7 | 57 s -> 56 s | 47 % -> 37 % | loses | nothing (done last session) |
| Rush with recoil (Lead Lance) | the same, hurts you a little | 48 s -> 48 s | 40 % -> 37 % | loses | nothing |
| **Heal** (Snack Time) | was instant and free; now your creature sits down in a green ring for 0.8 s | 70 s -> 71 s | 69 % -> 77 % | heals into hits: spoilt | **sits for 0.8 s (cannot move), a hit spoils it ("Oops! No heal")**, heals 45 % (was 35 %): heal between attacks |
| **Power up** (Team Cheer) | was 8 s of x1.5 for anyone; now an orange ring that a hit takes away | 49 s -> 51 s | 66 % -> 68 % | +40 % shot damage only until its first hit | **lasts while you are not hit** ("Power up lost") |
| **Tough** (Lie Low) | was 8 s of x1.6 defence; now a white brace ring for 0.7 s | 70 s -> 71 s; hurt 23 -> **10 %/min** | 70 % -> 69 % | a random brace now and then | **a hit within 0.7 s bounces off ("Blocked!") and stops the monster that threw it**; afterwards x1.3 defence for 8 s |
| Slow cloud (Twig Trip) | a coloured puddle where the target stands | 71 s -> 70 s | 52 % -> 55 %; the kid is hurt about half as much (309 vs 565-630 %/min) | loses | nothing: it already pays (slowed monsters wind up slower) |
| Sleepy cloud (Lullaby) | a short puddle: monsters touching it sleep and drop their attack | 69 s -> 69 s | 51 % -> 46 %; hurt 258 %/min | loses | nothing: the best support for the kid |

- With the real squad (Blazehound, Tidalord, Thunderwolf, three seeds, 60 and 20 fps, behind and first person): **mashing 0 / 96** (it was
  3 / 90 before: a mashed big blast no longer hurts anything), **skilled 144 / 144**.
- Heal and Tough never make a skilled player win sooner (support moves never can); they make a skilled player take less (Tough halves it)
  and they need timing. For the kid they help little, because the kid bot loses its squad in 15-20 s whatever it has (see step 3).
- Picture: `plans/chapter3/kind-burst-charge.jpg` (F held: the ring at about 4 blocks, round Blazehound).

### Step 3: fight length (done)

A new **person** bot (`tests/scribblebots.mjs`, closer to a child on a tablet than the kid): sees a warning 0.3-0.6 s late, walks out with
a wobbly thumb (up to 35 degrees off), dodges only half the time when late, taps one move about every 0.4-1.1 s (shots whether or not a hill
is in the way), holds a big blast 0.5-1.1 s, now and then taps another monster, heals under 40 %, swaps only sometimes. Seeded per fight.
`node tests/scribblemeasure.mjs length` (4 games x 3 seeds, behind and first person, 60 and 20 fps):

| Team | Bot | Behind your creature: won, median win (range) | First person: won, median win (range) |
| --- | --- | --- | --- |
| Blazehound, Tidalord, Thunderwolf (Lv 30) | naive (mashing) | 1 / 12 | 0 / 12 |
| | kid | 11 / 12, 20 s | 7 / 12, 24 s |
| | **person** | **12 / 12, 52 s (43-71)** | **11 / 12, 92 s (53-167)** |
| | skilled | 12 / 12, 23 s | 12 / 12, 32 s |
| The owner's team: Graphitan 56, Kitegale 91, Blazehound 89 (before the fix below) | naive | **12 / 12 (a hole)** | 12 / 12 |
| | person | 12 / 12, 48 s | 12 / 12, 47 s |
| The owner's team, after the fix | naive | **0 / 12** | **0 / 12** |
| | **person** | **12 / 12, 82 s (70-87)** | **9 / 12, 89 s (67-114)** |
| | skilled | 12 / 12, 42 s | 12 / 12, 65 s |

- **Found and fixed:** the monsters took your *lead's* level, so a weaker creature in front of two strong ones (the owner's Graphitan 56
  before Kitegale 91) made Lv 56 monsters that the Lv 91 creature then crushed: mashing won every fight. **The monsters now match your
  strongest creature.** The spec checks this team too (mashing must lose).
- **No HP change was needed:** a person takes about 1-1.5 minutes; the skilled bot 20-65 s. The owner's 5+ minutes came before the steep
  camera, the stronger big blast and this level fix; the likely causes were shots blocked by hills one cannot see from 45 degrees and a Lv 56
  lead facing Lv 56 monsters with a weak volley. Worth trying again on the iPad.
- The spec now reports a person's times on every seed (34-83 s in the last run).

### Step 4: first-person polish (done)

`node tests/scribblemeasure.mjs eyes` (your eyes at fov 75, looking a little down, iPad landscape; 10 games x 3 seeds per row):

| | Your creature on screen | A monster in your aim | Warnings' middle on screen | Person bot wins |
| --- | --- | --- | --- | --- |
| Before: your creature 1.6 to the right, 1.1 ahead (55 degrees off your look) | 37 % | 87 % | 61 % | 55 / 60 (two runs) |
| Tried: 1.0 right, 2.4 ahead | 83 % | 86 % | 74 % | 23 / 30 (in front it is hit more) |
| Tried: 1.3 right, 1.8 ahead | 72 % | 88 % | 71 % | 20 / 30 |
| **Kept: 1.6 right, 1.6 ahead** | **56 %** | 86 % | 70 % | 52 / 60 (within the noise) |

- Further in front, your creature is seen almost always but stands nearer the monsters and gets hit more, so the middle spot was kept.
- **A small blue arrow** on the ring of arrows round the crosshair shows where your creature is when it is out of view (the monsters
  already have red / white arrows there).
- **Your creature is drawn at 60 % in first person** (eased with the camera's glide; only the drawing, never the rules): a big creature
  (Tidalord) right beside you covered a third of the screen (`plans/chapter3/cam-after-9-eyes.jpg` is after the change).
- Aiming with your look (the monster within 0.6 rad of your look, else the shot flies the way you look) was measured as fine: a monster is
  in your aim 86-88 % of the time for the person bot. Not changed.

### Step 5: draw calls for the iPad (measured; nothing more changed)

| | Draw calls |
| --- | --- |
| Before (behind your creature, fov 75, 45 degrees) | about 335 |
| **Now behind your creature** (steep camera) | **113-157** |
| First person | 377 (the game's own view, as when walking) |
| Of these, the fight's own things | about 80: 73 are the parts of the five models (three monsters, your creature, your avatar); the scribble fence is 1, each monster's scribble 1, warnings and clouds 1 each |

The iPad's frame rate cannot be measured here. If it is low in a fight, the next step is merging each model's parts into one mesh per
material (the parts animate, so it needs care), or hiding your avatar while you fight behind your creature.

### The night run in short, and questions for the owner

**What changed (all behind `?preview`, live on `main`):**
1. The fight camera is the arena's: steep (about 62 degrees), fov 50, further back on a portrait iPad, and it stays still during a fight.
   The rise from your eyes is the same one move. More of the fight is on screen (monsters 85 -> 92 %, whole warnings 77 -> 87 % on an iPad
   in landscape) and draw calls fell from about 335 to 113-157.
2. Every move kind was measured. Four were fixed so they ask for skill and give nothing to a masher: the **big blast** (a ring grows on the
   ground while you hold; a full one hits hard and stops a monster about to strike), **heal** (your creature sits for a moment, and a hit
   spoils it), **power up** (it lasts until you are hit) and **Tough** (a brace: a hit just after it bounces off and stops the monster).
   The rest were already fair.
3. A fight now takes a person-like bot about 1-1.5 minutes. A hole was found and closed: with a weak creature in front of strong ones
   (like your Graphitan 56 before Kitegale 91) mashing won every fight. Now the monsters match your strongest creature.
4. First person: your creature sits more in view, is drawn smaller there and has a blue arrow when it is out of view.
5. The house rule holds everywhere: mashing loses (0 / 96 with the ready-made team, 0 / 24 with your own), the skilled bot wins
   (144 / 144), on seeds 1, 22 and 122, at 60 and 20 fps, behind and in first person, plus real keys and the iPad (`scribble` spec green).

**Not done:** a flatter patch spot (the steep view already calms the ground); merging the models' parts to save more draw calls (only if
the iPad struggles).

**Questions for you after playing (on the iPad if you can):**
1. Does the steep camera feel as good as the arena's? Is it too far away on the iPad (the creatures are smaller now)?
2. The camera no longer turns during a fight (stick up = away from the camera, like the arena). Do you miss turning it?
3. The big blast: does your son see the ring grow and understand "hold, then let go"? Is 1.1 s of holding too long for him?
4. Heal now makes your creature sit still for a moment. Fair, or too harsh for a child?
5. Does a fight last about right now (1-1.5 minutes)? Your Graphitan fight took 5+ minutes before; how long does it take now?
6. First person: is your creature in view often enough, and is the blue arrow clear?
7. Ready for the next step (the new world), or more fight tuning first?

## 10. Owner feedback 2026-11-10 and what changed

Owner: "I didn't notice the camera turn during a fight before. A slight turn to cover for the scene is ok." "It might be a bit too steep
now ... closer to what we have now, but still less" (on the owner's scale: before 45, now "80", wanted about "70"). "Moves are great. Fight
length is fine." "First person view is horrible lol ... this type of game is better with the pan out version." "Controls are a bit of a
mess: one creature's blast button is another creature's heal ... 5 buttons + directions is A LOT. At the same time I don't want to remove
powers."

**Changed (behind `?preview`):**
- **Angle:** 62 -> about 57 degrees down (12.6 up, 8.2 back, fov 50; about 15 blocks away as before). Picture: `plans/chapter3/cam-flat-8-fight.jpg`, `cam-flat-ipad.jpg`.
- **A slight turn:** the camera still never follows your look, but it turns by itself while a monster is near the edge of the screen,
  only the way that brings it back in, easing in and out, at most 0.25 rad/s (14 degrees a second). Turning toward the monsters' middle
  was tried first and turned all the time (11 degrees a second on average: they circle you), so it was dropped.
- **First person removed** (the V key, the pause screen's "🎥 Fight" button, the follow rules, the blue arrow); the bots and the spec play
  only the pan-out view. The night's first-person numbers (section 9, step 4) stay as a record.

What a child sees now (`scribblemeasure.mjs cam`, 24 person / skilled fights per row):

| Camera | Monsters on screen (iPad landscape / portrait) | Whole warnings on screen | Turning, on average |
| --- | --- | --- | --- |
| First try (45 degrees, fov 75) | 88 / 93 % | 80 / 90 % | (follows your look) |
| Night run (62 degrees, fixed) | 94.5 / 96.5 % | 93 / 96 % | none |
| 57 degrees, fixed | 92.5-94.5 / 96-97 % | 90-93 / 96-97 % | none |
| **Now: 57 degrees, turns at the edges** | **94 / 97.4 %** | **90 / 97.4 %** | **1.4-2.2 degrees a second** |

Mashing still loses (0 / 24 per seed), skilled wins all, the `scribble` spec is green.

### The open question: too many buttons, and they mean something different for every creature

Today each creature's four moves land on four slots in their own order, so the same slot is a blast for one and a heal for another;
with Dodge that is five buttons and a stick. The options (none built yet):

1. **Three buttons with a fixed meaning (recommended):** Dodge (Jump), **Attack** (the big round button) and **Special** (one smaller
   button). Attack is always "hurt a monster": it uses the creature's attack moves (shot, many shots, rush, big blast) and shows the icon
   of the one it will use next, with a fixed icon per kind (● shot, ●●● many shots, ➜ rush, ◎ big blast; hold for a big blast). Special is
   always "help": heal, power up, Tough, slow cloud, sleepy cloud. Every power stays; the child learns two buttons and reads one icon.
   Cost: you no longer pick between two attacks yourself; the button offers them in turn as they are ready.
2. **Five buttons, fixed places by kind:** the slots never change meaning (e.g. Shot, Rush, Blast, Help + Dodge); a creature without a
   kind has that slot dimmed. Every creature's buttons are in the same place, but it is still five buttons.
3. **Two moves per creature in a fight:** each creature brings one attack and one help move (its best, or chosen in the team screen);
   variety comes from swapping creatures (1 2 3, a tap on a card). Three buttons, simplest, but two of four moves sit out each fight.

Either way every kind gets a fixed icon and colour on its button and on the ground ring, so "this is a heal" reads in one look.

### Built 2026-11-10: Attack + Special (the owner chose option 1)

- **Three buttons with a fixed meaning:** Dodge (Jump / Space), **Attack** (the round action button / Q / a click) and **Special** (Place /
  E). Ride and Down are hidden in a fight. Attack uses the creature's attack moves (shot, many shots, big blast, rush), Special its help
  moves (heal, power up, Tough, slow cloud, sleepy cloud). Each button uses the ready move of its group used longest ago (so they take
  turns and none gets stuck), else waits for the one ready soonest, and shows that move's icon big with the word small:
  ● shot, ●●● many shots, ◎ big blast (hold), ➜ rush, ✚ heal, ▲ power up, 🛡 Tough, ☁ slow cloud, ☾ sleepy cloud. On a computer the cards
  show the button, the icon, the move's name and the key. Pictures: `plans/chapter3/buttons-ipad.jpg`, `buttons-desktop.jpg`.
- **The bots play through the same two buttons** (before, the skilled bot picked any move; now it can only wait for the right icon, e.g.
  ➜ while a monster winds up). Per kind (`scribblemeasure.mjs kinds`, 18 fights a row) nothing moved beyond the noise: the big blast,
  rushes and clouds keep their value through the shared button.
- **Mashing:** two buttons are easier to hammer than five. Over 24 fights per world: 2 / 24, 3 / 24, 7 / 24 at first (seed 122 at 20 fps
  reached 6 / 24, a quarter); in later runs about 1 fight in 10 overall (10 / 96), more at 20 fps (7 / 48). Tried and dropped: a "too
  soon" rest for tapping a dim button (no change: with two or three attack moves taking turns one is almost always ready) and monsters
  hitting harder (power 70: mashing 6 / 48 instead of 7 / 48, but the person and skilled bots lost now and then). The spec now judges
  mashing over 12 fights at each frame rate per world, all together under a quarter (4 fights were too few to tell 10 % from 25 %).
- Person bot: 34-80 s a fight, skilled 23-28 s, all won.

### Owner 2026-11-10: bigger buttons, and "my son doesn't see the scribble on his account / tablet"

- **Why the patch was missing on a busy world:** the rule that keeps it off your builds counted EVERY changed block (a dug-out block too)
  and checked a 12-block square round every candidate. Measured: with one dug block every 16 blocks round where you start, no spot was
  found at all (the owner's world, with fewer changes near the Champion's Tower, had one). Now only placed blocks inside the ring count,
  dug ones never; if nothing 14-23 blocks away fits, it looks 27-40 and then 48-64 blocks away. A world with a placed block every 2-6
  blocks over 80 x 80 now gets a patch 56 blocks away. (The other possible reason: `?preview` must be in the address on the tablet too.)
- **Bigger buttons in a fight:** Attack 100 -> 124 px, Dodge 84 -> 96, Special 68 -> 92; the icons are real emojis drawn 50 px / 38 px:
  🔵 shot, 🎊 many shots, 💥 big blast, 💨 rush, 💚 heal, 💪 power up, 🛡️ Tough, 🐌 slow cloud, 💤 sleepy cloud (the move kinds' own
  plain symbols, now in `movekinds.js`, drew tiny in the game's font; only the fight's buttons map them). Desktop cards bigger too.
