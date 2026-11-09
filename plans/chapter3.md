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
patch is 14-23 blocks from the start (a grey pencil knot with three monsters drawn in pencil). Without `?preview` nothing changes.

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
