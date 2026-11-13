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
| push | 💪 Push | boulders, cracked walls | normal (weak), metal, squad, knight, rock |
| hide | 🥷 Hide | sneak past someone watching | camo, ninja, tiny |
| bounce | 🦘 Bounce | ledges far higher than a jump | ball, funfair, surprise |
| lift | ✨ Lift | move things from afar | mind, alien |
| charm | 💖 Charm | win over someone grumpy (a treat when it looks at you) | pixie, cozy, food, funfair |
| sense | 🔊 Sense | an echo shows a hidden path; remember it | mind, sound |

Custom (the Wizard's guardian) has none yet: open question (section 6).

## 2. The 22 redesigns (id, stats, moves, evolution, catch rate kept; name, desc, model, flags, spawns may change)

Bodies are ideas: **names and final looks are chosen with the owner and their son first** (step A1).

| Creature (type) | New body (idea) |
| --- | --- |
| finnibone (bone) | a bony fish that walks on its fins like a mudskipper, clacking along the cave floor |
| twirlshell (bug) | a swirly-shelled snail with little dragonfly wings, buzzing from leaf to leaf |
| wifly → wifly2 (cyber) | "Wiflow": a little Wi-Fi router toddling on stubby legs; its bigger form a tower router on four legs |
| error404 (cyber) | a glitchy pixel cat that flickers and skips frames as it walks |
| voltwing (electric) | a roadrunner with a lightning-bolt crest |
| wattwink (electric) | a glow-worm whose tail is a light bulb |
| joltail (electric) | a land eel that slithers through wet grass, lighting it up |
| flarehawk (fire) | an emu with a flaming tail plume |
| nutlet → rivetron (metal) | rivetron: a big tin beetle on rolling treads; its engine wings only buzz |
| peekaw → ravenshade (ninja) | tiptoeing geckos: one hides behind its own tail; the big one is masked and creeps along walls |
| chirpit → loudbeak (normal) | a fluffy turkey chick; a peacock that fans its tail with a call that wakes the village |
| parroteer → featherbeard (pirate) | pirate monkeys: a little one in a bandana that repeats you; a captain with a hat and red coat |
| loopwyrm (portal) | a long snake that rolls like a hoop, a swirl in each loop |
| shimmerfin → spectrafin (rainbow) | rainbow pangolins whose scales sparkle (never swimmers); spectrafin is ridden on LAND now |
| ringlet (treasure) | a gold ring that rolls along on its edge, gem eye on top |
| lustrelle (treasure) | a gem candelabra that walks on its candle legs |
| gullop (water) | a noisy walrus pup that steals snacks from beach picnics |

**Type looks** (one thing drawn on the creatures listed; the rest of the type already fits):
alien = a hover glow under its feet (zorbit, blipling, blipstar, podlet, tallipod); cosmic = a stardust trail (moonhop, lunaroo);
gravity = little orbiting moons (orbikit, orbitah, danglet, turvysloth, wallibex); mind = a soft lifting glow (thinkit, visionelk,
puzzlet); paper = folds into a glider / a book flaps its pages (hopfold, frogami, pagelet, grandtome); pixie = small fairy wings
(starbelle, pompet, pomperina); rainbow = runs up its own rainbow (prismkit, spectrion, chromacurl); sound = rides its own sound
waves, rings of notes under it in the air (drumbo, bongorilla, gongolin, clawdio). Show a type look only while flying is fine.

**Animations only** (same body): beetlet, hornbeetle (wing cases open in flight), glitterbop (bops on the ground), pinwhirl (spins up
like a propeller), twilorb (rolls). Scalekin already has small wings.

## 3. Steps (one session can do A; B-D are one session each; E is ongoing)

**A. Redesigns + abilities data (no gameplay change outside ?preview)**
1. **Ask first:** show the owner the 22 ideas and ask for names and any changes (AskUserQuestion, a few at a time). Don't invent final
   names without them.
2. `src/abilities.js` (pure, no imports): `ABILITIES` (the 17, append-only ids, icon, name, short line), `TYPE_ABILITIES`,
   `abilitiesOf(species)` (from its type; Custom = `[]` for now), `hasAbility(species, id)`.
3. For each redesign in `species.js`: same id, new `name` / `desc` / `model` (a new builder in `shapes.js` where it is a new family:
   the owner wants unique looks), `flies` / `floats` set to match the body; move its `SPAWNS` entries to fitting biomes (fish and
   sea birds that now walk leave water tables); `traits.js` spectrafin `water` -> `land`.
4. The type looks and animations (shapes.js / `animateModel`); keep draw calls low (look at `tests/perf.mjs`).
5. Fix every text that names a changed creature or describes the old body: gym teams keep ids (no change), but dialogue, `README.md`
   tables, `STORY.md`, Picture World words, wobbleland patch species are fine by id. `grep` the old names.
6. **No duel `VERSION` bump** as long as stats, moves and types stay the same (only looks and names change). No `WORLD_VERSION` bump.
7. New spec `abilities` (Node + browser): every wild type in `TYPE_ABILITIES`; **consistency**: no `flies` species in a type without
   Fly, every sky-ride species in a Fly type, every water-ride species in a Swim type, no fish shape in a type without Swim; the 22
   ids still exist with their stats / learn sets unchanged; an old save holding Flarehawk and Spectrafin loads with the new name and
   model, its team / Book / ride (spectrafin on land) work. Re-run `roster`, `blocks`, `seventh`, `fx`, `book`, `riding`, `traits`,
   `swap`, `pvp`. Model screenshots for the owner (a `*-preview.mjs` like `tests/houseprops-preview.mjs`).

**B. Ability chips on cards**
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

Freeze has one type; Normal's Push, Grass's Climb, Time's Dash are weak fits; Sense and Charm need real skill games. Trimming to 15 would
drop Freeze and fold Lift into Mind's Sense.

## 6. Open questions for the owner

1. Names for the 22 (and whether all of them really change).
2. Custom (your guardian): pick its abilities on the drawing board, or none? Its kit has wings, so if it may not fly, the wings part
   needs a rule.
3. Should a type with no fitting ability stay plain (Normal)?
