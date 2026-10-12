# PokeCraft

A browser game that mixes a Minecraft-style voxel world with creature collecting.
Explore a procedurally generated block world, build and dig, battle and catch
wild creatures in Capture Cubes, and beat all 16 Gym Leaders to collect every badge.

Built with plain JavaScript and [three.js](https://threejs.org/). There is no build step.

## Running it

ES modules must be served over HTTP, so opening `index.html` directly will not work. From the repo root:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000> in a desktop browser.

The game is fully static, so it also works on GitHub Pages: enable Pages for the branch and open the URL.

### On a tablet

The game works on iPads and Android tablets with touch controls, which turn on automatically. You can get it onto a tablet in two ways:

- **GitHub Pages** (easiest): enable Pages for this repo and open the URL on the tablet.
- **From your computer**: start the server with `python3 -m http.server 8000`, find your computer's local IP address (for example `192.168.1.20`), and open `http://192.168.1.20:8000` on the tablet. Both devices must be on the same Wi-Fi.

On iPad, use Share → **Add to Home Screen** for a full-screen, app-like experience.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Space | Jump / swim up |
| Shift | Sprint |
| Mouse | Look |
| Left click | Break block, battle the creature under the crosshair, or talk to a person |
| Right click | Place the selected block |
| 1–9 / mouse wheel | Pick a block from the hotbar |
| B | Blocks screen: choose which blocks are in your hotbar |
| E | Battle the targeted creature, or talk to a person |
| P / Tab | Team & storage screen |
| C | Creature Book: every creature you've seen and caught |
| Esc | Pause (Resume, Main menu, Play together) |

On a tablet:

| Touch | Action |
| --- | --- |
| Left joystick | Walk (push all the way to run) |
| Drag on the right side | Look around |
| Tap a creature or person | Battle it, or talk to them |
| Battle / Challenge / Heal button | Same as tapping the creature or person under the crosshair |
| Break / Place / Jump buttons | Break or place a block at the crosshair, jump or swim up |
| Tap the hotbar | Pick a block (tap the picked one again to change it) |
| Team / Blocks / Book / II buttons | Team screen / Blocks screen / Creature Book / pause |

## Features

- **Voxel world**: a 224×224 terrain with a day/night cycle and 11 kinds of places (biomes): plains, flower meadows, forests, swamps, beaches, lakes, deserts with cacti, snowy pine forests with frozen lakes, mountains, snowfields and high peaks with glowing star crystals.
- **24 building blocks**, including glass, stone bricks, lamps (they glow at night), ice, sandstone, cactus and flower bushes. Press **B** (or tap the picked hotbar slot again) to choose which 9 are in your hotbar. Dig into rock to find coal and gold ore; gold sometimes hides a Capture Cube.
- **102 original creatures**, 6 for each of the 17 types (see below). Each lives where it fits: pixies in flower meadows, toxic creatures in swamps, fire and rock ones in the desert, ice ones only in snowy places, and cosmic ones come out at night, most of all on the high peaks. Ghosts also only come out at night.
- **Champion's Tower**: a final challenge after all 16 badges, with guards, a coach, Champion Solenne and the legendary Zenithar.
- **Rainbow creatures** are the rarest of all. They only appear in daytime, their colours shimmer, and a message tells you when one is nearby.
- **Evolution**: 46 creatures evolve when they reach a certain level, for example Ampup → Thunderwolf, Moonhop → Lunaroo and Drumbo → Bongorilla.
- **Starter choice**: Emberpup (fire), Sproutle (grass) or Bubbuck (water). Each one evolves at level 16.
- **Turn-based battles** that play out in the world. They include a type-effectiveness chart, same-type bonus, critical hits, priority moves, move effects (see **Moves** below), switching and running away. Your whole team shares the XP.
- **Moves**: 77 moves, at least 4 for every type, and every creature also learns moves from a second type. The buttons say what each move does. When a creature with 4 moves wants to learn a new one, you pick which move to forget (or say "Don't learn"). Older creatures get the new moves one at a time as they level up.
- **Catching**: throw Capture Cubes at wild creatures. Your odds are better when the target has low HP. You start with 10 cubes and find more by winning battles or breaking leaves.
- **Progression**: XP, level-ups, learning new moves and evolution. Your team holds up to 6 creatures; extra catches go to a storage box.
- **Creature Book**: press **C** (or the Book button). Every creature you meet in a battle shows its picture, name and type; the ones you haven't met are black shapes. Catch one to fill in its whole page: where it lives, how it evolves, its moves and what it is strong or weak against.
- **Sound effects**: soft, short sounds for building, battles, catching and badges. Sound-type creatures have their own tunes (Dinglet rings, Gongolin goes BONG, Drumbo drums), their moves sound special, and in the wild they sing every few seconds when you are near, with music notes floating up so you can spot them. Turn them off with the **Sound** button on the pause screen.
- **Weather** changes every few minutes and depends on where you are: rain, thunderstorms, snow in cold places, sandstorms in the desert, misty swamp mornings, shooting stars on clear nights, and a rainbow after rain. Each kind brings out more of some creatures: storms bring electric ones, rain water ones, snow ice ones, and rainbows make rainbow creatures much easier to find.
- **Auto-save** to this device, plus **online saves** when you sign in (see below). This saves your world edits, team, badges, cubes and position.

Creatures farther from the starting point are higher level. Your team slowly regains HP outside of battle.

## Moves

Every move has one small effect at most. The battle buttons say what a move does.

| Move effect | What it does |
| --- | --- |
| Heals you | Gets back half of your HP (Rest Up, Sap Sip, Shimmer) |
| Raises your attack / defence | One step up, up to 3 steps (Pump Up, Hunker Down, Deep Focus, Iron Wall) |
| Lowers the foe's attack / slows the foe | One step down (Grumble, Silk Wrap, Chill Wind...). "May" means it only sometimes works |
| May make the foe flinch | If you move first, the foe may lose its move |
| Puts the foe to sleep | The foe skips one move (Lullaby, Sweet Dreams, Big Bong). Sleepy creatures are easier to catch |
| Hits 2 to 4 times | Several small hits (Seed Volley, Rivet Shot, Meteor Shower) |
| Hurts you a little too | A big hit with a little recoil. It never knocks you out (Inferno Dash, Drake Charge) |
| Never misses | Always hits (Mind Trick, Color Splash and the special moves) |

Stat changes and sleep go away when a creature is switched out. A few creatures learn a **special move** (Blazehound, Tidalord, Grovebeast and Gongolin at Lv 30, Zenithar at Lv 45). Some moves were renamed to original names (Bump, Belly Bash, Cinder, Bubble Pop, Zap, Blaze Burst, Snow Storm, Nibble, Shadow Dash). Player battles need both players to have the latest version of the game.

## Types

| Type | Strong against | Notes |
| --- | --- | --- |
| Normal | — | Can't hit ghosts at all |
| Fire | Grass, ice, bug, metal | |
| Water | Fire, rock | |
| Grass | Water, rock | |
| Electric | Water, sound | |
| Rock | Fire, electric, ice, bug | |
| Ice | Grass, bug, drake | |
| Bug | Grass, mind | |
| Ghost | Ghost, mind, rainbow, cosmic | Can't hit normal creatures |
| Mind | Toxic, drake, cosmic | Psychic powers |
| Metal | Ice, rock, pixie | Very tough; toxic attacks don't affect it |
| Toxic | Grass, pixie | Can't hurt metal |
| Pixie | Drake, ghost | Drake attacks don't affect it |
| Drake | Drake | Powerful dragons, resist fire, water, grass and electric |
| Rainbow | Ghost, toxic, mind | Very rare |
| Cosmic | Rock, drake, sound | Stars and space; come out at night |
| Sound | Ice, bug, mind | Loud and musical |

Cosmic beats sound, sound beats mind, and mind beats cosmic.

## Gyms and badges

There are 16 gyms scattered around the map, one for each type except normal. Each gym is a brick building with a roof in its type's colour. The closer a gym is to the start, the easier it is:

| # | Gym | Type | Leader | Leader's levels |
| --- | --- | --- | --- | --- |
| 1 | Boulder Gym | Rock | Leader Rocco | 6–8 |
| 2 | Hive Gym | Bug | Leader Mantis | 8–10 |
| 3 | Swamp Gym | Toxic | Leader Venna | 10–12 |
| 4 | Tide Gym | Water | Leader Marina | 12–14 |
| 5 | Twinkle Gym | Pixie | Leader Luma | 14–15 |
| 6 | Grove Gym | Grass | Leader Fern | 15–17 |
| 7 | Volt Gym | Electric | Leader Sparky | 17–19 |
| 8 | Echo Gym | Sound | Leader Melody | 18–20 |
| 9 | Iron Gym | Metal | Leader Forge | 19–21 |
| 10 | Mystic Gym | Mind | Leader Sage | 20–22 |
| 11 | Blaze Gym | Fire | Leader Cinder | 22–24 |
| 12 | Frost Gym | Ice | Leader Yuki | 23–25 |
| 13 | Comet Gym | Cosmic | Leader Nova | 24–26 |
| 14 | Phantom Gym | Ghost | Leader Raven | 25–27 |
| 15 | Scale Gym | Drake | Leader Wyvern | 26–28 |
| 16 | Prism Gym | Rainbow | Leader Aurora | 27–30 |

Inside each gym is an apprentice trainer you must beat before the Gym Leader will battle you. Trainer battles use 2–3 creatures in a row, and you can't catch their creatures or run away. Beating a leader earns that gym's badge and 5 Capture Cubes. Collect all 16 to open the Champion's Tower.

The top-right corner shows your badges and points you to the next gym. Catch creatures that have a type advantage before each one. **Healer Hana**, standing next to your starting point, fully heals your team.

## Champion's Tower

After you collect all 16 badges, the **Champion's Tower** opens. It is a tall stone tower with a rainbow roof and a glowing crystal on top, near the middle of the map (the arrow in the top-right corner shows the way). Inside:

- **Nurse Poppy** heals your team. **Coach Dex** trains you with 3 creatures at your best level and gives **double XP** (and 1 Capture Cube) every time.
- **Guard Bram** (Lv 34–36) and **Guard Opal** (Lv 36–38) must be beaten first, one after the other.
- **Champion Solenne** has 6 creatures (Lv 40–45). Her last one is **Zenithar**, a one-of-a-kind rainbow guardian. It can't be caught, and it **powers up** when it is down to half its health!
- If you win, you become the **Champion**: you get 20 Capture Cubes, a gold "Champion" title on the screen, and the win is saved. You can challenge Solenne again any time (her creatures are 3 levels stronger).
- If you lose, you wake up at the start, with a hint. Heal with Nurse Poppy and train with Coach Dex, then try again.
- After 16 badges, wild creatures are also 10 levels stronger, so there is always something to train against.

## Online saves

Sign in on the title screen to keep your progress online and continue on another device. Accounts and saves use [Supabase](https://supabase.com) (project `pokecraft`).

- **Create account** sends a confirmation email. After clicking the link, sign in with the same email and password. Each device only needs to sign in once.
- **Forgot password?** emails a link; opening it brings you back to the game to choose a new password.
- The game saves online every minute, after every battle, when you pause, and when you leave the page. It always saves on the device too, so it keeps working offline.
- When you sign in, the game loads whichever save is newer: the one online or the one on this device.
- Each player can only read and write their own save. This is enforced by Row Level Security in the database, so the project URL and publishable key in `src/cloud.js` are safe to be public.

If the save server can't be reached, the game still works and saves on the device only.

### Supabase setup

- **Authentication → URL Configuration**: Site URL and Redirect URLs must include the game's address (for example `https://gondiken.github.io/pokecraft/`), or email links won't return to the game.

## Play together

Two or more people can play in the same world at the same time, each on their own device.

1. The player whose world you want to use pauses the game, types their name and presses **Share my world**. A 5-letter code appears.
2. The other player pauses their game, types their name and the code, and presses **Join a world**.

You see each other walking around with name tags, with each player's lead creature following them. Blocks that anyone places or breaks show up for everyone. Each player keeps their own team, badges and Capture Cubes, and has their own battles and wild creatures. Building in the shared world is saved in the host's world.

**Battle each other**: look at (or tap) another player and click or press **E** to ask for a battle. They get a **Battle!** / **Not now** question (or press **Y** / **N**). Both teams fight at full HP, nobody's creatures get hurt or lost, and there is no XP. The winner gets **3 Capture Cubes**. **Give up** ends the battle early.

A visitor's own world is untouched. **Go back to my world** returns them to it, and that happens automatically if the host stops sharing or leaves. The connection uses Supabase Realtime. Neither player needs to be signed in, but both need an internet connection.

For testing on one computer, add `?mp=local` to the address. Tabs in the same browser then connect to each other directly, without the server.

## Tests

Browser tests (Playwright) are in `tests/`: `cd tests && npm install && npm test`. See `CLAUDE.md` for details.

## Code layout

| File | Purpose |
| --- | --- |
| `src/main.js` | Renderer, input, game loop, save/load, title screen |
| `src/world.js` | Terrain generation, block storage, chunk meshing, voxel raycast |
| `src/blocks.js` | Block definitions and the procedurally drawn pixel-art texture atlas |
| `src/player.js` | First-person movement and collision |
| `src/species.js` | Types, moves, species data, stats/XP, blocky creature models |
| `src/gyms.js` | Gym, leader and trainer data, and the Champion's Tower |
| `src/npc.js` | Blocky people: trainers, leaders and the healer |
| `src/creatures.js` | Wild creature spawning and wandering AI |
| `src/battle.js` | Battle flow, animations, catching |
| `src/ui.js` | HUD, team screen, creature portraits |
| `src/touch.js` | Tablet controls: joystick, drag-to-look, tap-to-interact, buttons |
| `src/cloud.js` | Accounts, online saves and the live channel for playing together (Supabase) |
| `src/multiplayer.js` | Play together: sharing a world, other players' avatars, block syncing |
| `src/duel.js` | Battles between players: asking, answering, swapping each turn's choices |
| `src/weather.js` | Weather: rain, storms, snow, sandstorms, fog, rainbows, and the creature spawn boosts they bring |
| `src/sound.js` | Small sound effects made with Web Audio (no sound files) |

All creatures, names and art are original. To add a creature, add an entry to `SPECIES` in `src/species.js` and list it in a biome in `SPAWNS`. To change a gym, edit its entry in `src/gyms.js`.
