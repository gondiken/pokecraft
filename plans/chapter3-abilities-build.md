# Chapter 3: creature abilities, the build plan (owner 2026-11-13)

How the design talk in `plans/chapter3-ways.md` section 10 ended, turned into steps. The page with the full map, the grid and every
creature: https://claude.ai/artifact/EdtF4Naq98N1fUHBLhstny (private to the owner). This file is the source of truth for the build;
the page is the picture of it.

## 0. What was decided

1. **Every creature walks.** On top, its TYPE gives a set of abilities (none, one or several). **Every creature of a type has all of
   them** (never "some fly, some swim"). Types and abilities are many to many.
2. **The card says it:** a creature's abilities show as chips ([🪽 Fly] [💡 Glow]) on every card: team screen, Book, Swap, the
   creature you are. Walking has no chip.
3. **The world says what it needs:** at a place, the button word appears if your creature can ("Climb!"); if not, the place shows
   the chip it needs and which of your squad have it.
4. **Looks only must not contradict:** no wings in a type without Fly, no fish in a type without Swim. Other abilities need no drawing.
5. **Nobody changes type.** A creature whose body contradicts its type is **redesigned** (new body, often a new name) and stays in its
   type. A type that needs a little help gets a **type look** (drawn on every creature of the type that lacks it) or a small
   **animation** (same body, moves a bit differently).
6. **Owner 2026-11-13: a redesign reaches every player.** The species **id never changes**; a save stores only the id, so name and
   model come from `SPECIES` and every player who owns the creature sees its new name and shape at the next load (Book seen / caught
   are by id too). No save migration.
7. Sound walks AND flies ("sound travels through the air"): Boomwing and Echobat stay exactly as they are.

## 1. The 17 abilities (ids are saved later: append-only)

| id | Ability | What a place asks | Types |
| --- | --- | --- | --- |
| fly | 🪽 Fly | open sky, a gap with no floor | bug, ghost, mind, pixie, drake, rainbow, cosmic, sound, alien, sky, paper, bubble, gravity |
| swim | 🌊 Swim | dive deep, hold its breath | water, pirate, atlantis, bubble |
| climb | 🧗 Climb | walls, vines, a ceiling, a shaft | grass (weak), bug, slime, parkour, ninja, gravity |
| dig | ⛏️ Dig | soft earth, buried chests | bone, treasure, pirate, rock |
| squeeze | 📄 Squeeze | cracks, gaps under doors | slime, paper, tiny, doodle |
| pass | 👻 Pass through | bars, glass, thin walls | ghost, dream, portal, mirror |
| glow | 💡 Glow | the dark | fire, electric, rainbow, cosmic, light, atlantis |
| burn | 🔥 Burn | thorns, tangles, ice walls | fire, toxic, drake |
| freeze | ❄️ Freeze | a path over wild water | ice |
| zap | ⚡ Zap | power a lift, a bridge, a door | electric, metal, cyber |
| dash | 💨 Dash | closing doors, crumbling floors | time (weak), parkour, racer |
| push | 💪 Push | boulders, cracked walls | normal, metal, squad, knight, rock |
| hide | 🥷 Hide | sneak past someone watching | camo, ninja, tiny |
| bounce | 🦘 Bounce | ledges far higher than a jump | ball, funfair, surprise |
| lift | ✨ Lift | move things from afar | mind, alien |
| charm | 💖 Charm | win over someone grumpy (a treat when it looks at you) | pixie, cozy, food, funfair |
| sense | 🔊 Sense | an echo shows a hidden path; remember it | mind, sound |

Custom (the Wizard's guardian) is the only Custom creature you can have, so it may differ per player: **decided** in section 6.

## 2. The 22 redesigns (id, stats, moves, evolution, catch rate kept; name, desc, model, flags, spawns may change)

**Names are decided** (2026-11-13). Rule: keep a name when it still fits the new body, so players lose as little as possible.

| id (type) | Name (old -> new) | New body |
| --- | --- | --- |
| finnibone (bone) | Finnibone (kept) | a bony fish that walks on its fins like a mudskipper, clacking along the cave floor |
| twirlshell (bug) | Twirlshell (kept) | a swirly-shelled snail with little dragonfly wings, buzzing from leaf to leaf |
| wifly (cyber) | Wifly -> **Wiflow** | a little Wi-Fi router toddling on stubby legs, signal bars on its back |
| wifly2 (cyber) | Wifly 2.0 -> **Wiflow 2.0** | a tower router striding on four legs, full signal bars |
| error404 (cyber) | Error404 (kept) | a glitchy pixel cat that flickers and skips frames as it walks |
| voltwing (electric) | Voltwing (kept, owner 2026-11-14) | the same bird with small wings; it walks instead of flying |
| wattwink (electric) | Wattwink (kept) | a glow-worm whose tail is a light bulb; it blinks hello on warm nights |
| joltail (electric) | Joltail (kept) | a land eel that slithers through wet grass, lighting it up with little zaps |
| flarehawk (fire) | Flarehawk -> **Flaremu** | an emu with a flaming tail plume that sprints across the plains |
| rivetron (metal) | Rivetron (kept) | a big tin beetle on rolling treads; its engine wings only buzz (nutlet, its first form, already walks) |
| peekaw (ninja) | Peekaw -> **Peekko** | a tiptoeing gecko that hides behind its own tail and peeks |
| ravenshade (ninja) | Ravenshade -> **Ninjecko** | a big masked gecko that creeps along walls without a sound |
| chirpit (normal) | Chirpit (kept) | a fluffy turkey chick that chirps and struts about at sunrise |
| loudbeak (normal) | Loudbeak (kept) | a peacock that fans its tail with a call that wakes the whole village |
| parroteer (pirate) | Parroteer -> **Monkeer** | a little monkey in a striped bandana that repeats everything you say |
| featherbeard (pirate) | Featherbeard -> **Bananabeard** | a monkey captain with a big hat, a long red coat and a banana-yellow beard |
| loopwyrm (portal) | Loopwyrm (kept) | a long snake that rolls like a hoop, a swirl in each loop |
| shimmerfin (rainbow) | Shimmerfin -> **Shimmerscale** | a little pangolin whose scales sparkle in every colour (never a swimmer) |
| spectrafin (rainbow) | Spectrafin -> **Spectrascale** | a big rainbow pangolin, good luck to see; ridden on LAND now (`traits.js` water -> land) |
| ringlet (treasure) | Ringlet (kept) | a gold ring that rolls along on its edge, gem eye on top |
| lustrelle (treasure) | Lustrelle (kept) | a gem candelabra that walks on its candle legs |
| gullop (water) | Gullop (kept, owner 2026-11-14) | a noisy duck (the old bird with a flat bill, small wings, webbed feet) that swims and waddles |

The bodies are the brief; the building session may refine details, then shows the owner screenshots before finishing.

**Type looks** (one thing drawn on the creatures listed; the rest of the type already fits):
alien = a hover glow under its feet (zorbit, blipling, blipstar, podlet, tallipod); cosmic = a stardust trail (moonhop, lunaroo);
gravity = little orbiting moons (orbikit, orbitah, danglet, turvysloth, wallibex); mind = a soft lifting glow (thinkit, visionelk,
puzzlet); paper = folds into a glider / a book flaps its pages (hopfold, frogami, pagelet, grandtome); pixie = small fairy wings
(starbelle, pompet, pomperina); rainbow = runs up its own rainbow (prismkit, spectrion, chromacurl); sound = rides its own sound
waves, rings of notes under it in the air (drumbo, bongorilla, gongolin, clawdio). Show a type look only while flying is fine.

**Animations only** (same body): beetlet, hornbeetle (wing cases open in flight), glitterbop (bops on the ground), pinwhirl (spins up
like a propeller), twilorb (rolls). Scalekin already has small wings.

## 3. Steps (each one session; the first is only the redesigns)

**A. The creature redesigns only** (no abilities yet; nothing changes in how anyone moves)
**Owner 2026-11-14:** Wiflow / Wiflow 2.0 / Error 404 keep their old bodies (walking, not floating), Voltwing keeps its name and bird body with small wings, Gullop is a duck (old bird + flat bill, swims). **Built 2026-11-13** (spec `redesign`, pictures `node tests/redesign-preview.mjs`): as below, plus: Joltail in meadows and swamps, Shimmerscale / Spectrascale in meadows and forests by day; Monkeer left the open-sea table; the Pirate Seas' Boss is renamed Captain Bananabeard (his "Squawk!" is "Ook ook!") and Parrot Perch is Palm Perch; Glitterbop and Twilorb no longer float; a type look is drawn always (small), not only in flight.
1. For each of the 22 in section 2, in `species.js`: same id; the new `name` where it changes, a new `desc`, a new `model` (a new body
   builder in `shapes.js` for a new family: the owner wants unique looks, evolutions may share one), `flies` / `floats` removed where the
   new body walks (twirlshell keeps flying). Move `SPAWNS` entries to biomes that fit (fish and sea birds that now walk leave water
   tables; check `blocks` / `roster` coverage specs).
2. `traits.js`: spectrafin's ride `water` -> `land`.
3. The eight type looks and five animations of section 2 (shapes.js / `animateModel`); a type look may show only while flying (that
   is chapter 3, so it can wait for step C if it needs creature mode). Keep draw calls low (`tests/perf.mjs`).
4. Texts: `grep` every old name (Voltwing, Flarehawk, Peekaw, Ravenshade, Parroteer, Featherbeard, Shimmerfin, Spectrafin, Gullop,
   Wifly) and every line that describes an old body (wings, fins, feathers) in `src/`, `README.md`, `STORY.md`, gym dialogue.
   Gym teams, Wobbleland patches and Bosses keep the ids: only check that their battles look right.
5. **No duel `VERSION` or `WORLD_VERSION` bump**: stats, moves, types and ids stay the same; only names and looks change.
6. Spec `redesign`: the 22 ids exist with stats, learn sets, evolutions, types and catch rates unchanged (compare with a fixture
   recorded before the change); no redesigned walker has `flies` / `floats`; an old save holding Flarehawk, Spectrafin and Wifly 2.0
   loads with the new names and models in the team, the box and the Book, and Spectrascale is ridden on land. Re-run `roster`,
   `blocks`, `seventh`, `four-types`, `three-types`, `ninja`, `pirate`, `fx`, `book`, `riding`, `traits`, `swap`, `pvp`, `gym`.
   A model photographer (like `tests/houseprops-preview.mjs`) for the owner: every redesign beside its old look.

**B. Abilities data + chips on cards**
`src/abilities.js` (pure, no imports): `ABILITIES` (the 17, append-only ids, icon, name, short line), `TYPE_ABILITIES`,
`abilitiesOf(species, creature)` (from its type; the guardian from its design, section 6), `hasAbility`. Spec `abilities`: every wild
type mapped; consistency (no `flies` species in a type without Fly, every sky-ride species in a Fly type, every water-ride species in
a Swim type, no fish shape in a type without Swim). Then the chips:

Team screen card, the Book's creature page (and a type's abilities on its type page), the Swap list, the trade cards, the creature you
are (chapter 3). One chip style, icons from `ABILITIES`. Readable on the iPad. Spec: chips present and equal for two creatures of one
type.

**C. The world says what it needs** (chapter 3, ?preview)
A generic hook for a place: `needs: '<ability>'` -> the button word if the creature you are has it; if not, the place shows the chip
and lights up which of your three have it (Swap is one tap). `creatureways.js` WAYS / `bodyOf` are replaced by `abilitiesOf`: in
creature mode a creature flies iff its type has Fly, dives iff Swim, climbs iff Climb (`clingStep` exists). Convert the two test
places: the Drip Tower = Climb; Storm Island = Fly (owner: it was "just timing": redo it as a real flying skill, or drop it).
Glowcap Caves: `groundrules.js` `Dark.BRIGHT` reads Glow (adds Rainbow and Atlantis; re-run `wobble` cave bots).

**D. One real place per ability, two at a time** (Bumpy Hills, then the next regions)
Each a skill game, never a key: easy to understand, hard to master; bots with the real Player prove a naive kid with the ability fails,
a skilled one wins, and no creature without it (or a mix through Swap) gets in, at 60 and 20 fps. The obvious shortcut must never
win (CLAUDE.md). Charm and Sense must be real timing / memory games or be dropped. Places hold extras (chests, secret patches,
shortcuts), the main way stays open to everyone.

**E. Later:** Easy / Normal / Hard (`difficulty.js`), kind help, play together (a friend sees your creature), the guide and "Where to
go" for ability places.

## 4. What must not break

- Saves: only ids are stored; never rename an id. `cleanCreature`, trades, duels, the box, the Book all key on ids.
- Outside chapter 3 nothing changes in how anyone moves; riding keeps its own list (only spectrafin's kind changes).
- Gyms, Bosses and Picture Worlds that use a redesigned creature keep it by id (e.g. the Electric gym's Voltwing and Joltail, the Fire
  gym's Flarehawk, the Water gym's Gullop, Wobbleland patches): check the battles still look right.
- Saturnowl (the Cube Planets Boss's giant) is not redesigned.

## 5. Weak spots to keep an eye on

Freeze has one type; Grass's Climb and Time's Dash are weak fits; Sense and Charm need real skill games. Trimming to 15 would
drop Freeze and fold Lift into Mind's Sense.

## 6. Decided (2026-11-13)

1. **Names:** section 2.
2. **Normal keeps Push.**
3. **The guardian (Custom):** it is the only Custom creature a player can have, so its abilities may come from its own design: it
   has **Fly when its parts fly** (wings or the cloud: guardiankit `flies`), plus **one ability you choose** on the drawing board (a
   new row of ability chips; saved in the design, `cleanDesign` keeps it; the rematch redesign may change it). Built in step B.

## 7. Owner 2026-11-14 (after step A)

- Renamed: Dash -> **Sprint** (going fast), Hide -> **Sneak**, Zap -> **Power** (its first name: making a machine work).
- Time loses Dash and gets **Rewind** (a new ability): a place where it is already too late when you walk in (the bridge falls, the
  door slams the moment you enter); only turning the last moments back gets you through. Sprint = you can make it if fast enough;
  Rewind = nobody can, it already happened.
- Grass keeps Climb; a better Grass ability is welcome, but ask the owner first.
- **Every ability must solve something no other ability can** (owner: "how could Bounce solve something Fly can't?"). Review in
  progress: the proposals and the open questions are in the chat of 2026-11-14 and on the map page.
- Later the same day: Zap stays **Zap** ("Power" could be misread). Bounce is dropped (nothing it solves that Fly cannot); Ball gets
  Push (kicking = pushing), Surprise proposed Charm. **Swim = fast in water** (up a waterfall, against a current; anyone can already
  dive), Freeze = water you must not touch (freeze a path, walk on top). **Pass Through** stays for Ghost (maybe Portal), to be
  told apart from Squeeze (proposal: Pass = no opening at all, Squeeze = a crack); Dream and Mirror need their own. Lift = something
  you see but can never reach (a cage, behind glass). Open: Climb vs Fly (the owner never liked the wing-folding rule; it is no
  reason). Proposals: Grow for Grass (roots split cracked stone, Push then only shoves), Heal for Pixie / Cozy / Food. Kick, Reflect
  and Portal as abilities: no (Portal "almost a cheat code").
- Confirmed (2026-11-14): Grow for Grass (with Climb), Heal for Pixie / Cozy / Food, Charm for Surprise, Pass Through for Ghost,
  Portal, Dream and Mirror. **Climb vs Fly holds with no exception:** flying rises only `RIDE.sky.cap` 6 over the floor right
  below you (player.js `fly`, `floorBelow`), so a sheer wall taller than 6 in one face needs Climb; a stepped slope can be flown
  ledge by ledge. **Pass Through** only through faded walls (half-erased pencil walls, solid to everyone else). Open: Swim vs Freeze.
