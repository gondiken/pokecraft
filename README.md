# PokeCraft

A browser game that mixes a Minecraft-style voxel world with creature collecting.
Explore a procedurally generated block world, build and dig, battle and catch
wild creatures in Capture Cubes, and beat all 25 Gym Leaders to collect every badge.

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
| Space | Jump / swim up (swim into a bank and hold it to climb out) |
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

- **Voxel world**: a 288×288 terrain (the first 224×224 is the original land; the new land is to the east and south) with a day/night cycle and 11 kinds of places (biomes): plains, flower meadows, forests, swamps, beaches, lakes, deserts with cacti, snowy pine forests with frozen lakes, mountains, snowfields and high peaks with glowing star crystals. Under the hills there are also **caves** (a 12th kind of place): look for a **stone arch with two lamps** on a hill, and walk down its stairs into big, lit caves with huge halls (crystal halls, glowing mushroom halls, underground lakes and a giant fossil with a ribcage), wide tunnels to explore, and lamp posts at the old small holes so you can spot them at night. Star crystals and glowing mushrooms light the way, and rock, metal, ghost and bone creatures live down there. Your lead creature glows to light your way underground, and **treasure chests** hide 3 Capture Cubes each.
- **26 building blocks**, including glass, fluffy cloud blocks, stone bricks, lamps (they glow and light up the ground around them at night), Glowcap mushrooms (they glow too), ice, sandstone, cactus and flower bushes. Press **B** (or tap the picked hotbar slot again) to choose which 9 are in your hotbar. Dig into rock to find coal and gold ore; gold sometimes hides a Capture Cube.
- **182 original creatures**, 7 for each of the 26 types (see below). Each lives where it fits: pixies in flower meadows, toxic creatures in swamps, fire and rock ones in the desert, ice ones only in snowy places, cosmic ones come out at night, most of all on the high peaks, and **Bone** creatures (skulls, skeleton dogs, fossil dinos) live only in caves. **Alien** creatures (flying saucers, three-eyed visitors, space pods) drop in at night. Ghosts also only come out at night. **Sky** creatures (kites, balloons, sky whales) float over the mountain tops, **Slime** creatures wobble around swamps and caves, **Light** creatures (sun foxes, lighthouses) love sunny meadows and beaches, and **Paper** creatures (paper planes, origami frogs, storybooks) wander plains and forests. Three types have their own special way to be found: **Time** creatures (hourglasses, metronomes, alarm clocks) only come out for a minute at sunrise and sunset, when the sky turns orange and you hear a soft tick-tock. **Camo** creatures look exactly like a block (leaves, sand, stone or snow) and never move: watch for a blink, then hit or tap the block. **Cyber** creatures (pixel blobs, mouse pointers, Wi-Fi butterflies) only appear when two friends play together close by.
- Every type also has one rare creature that never evolves, like Lanterboo the lantern ghost, Clawdio the jukebox crab or Chromacurl, a lizard that slowly changes colour.
- **Champion's Tower**: a final challenge after all 25 badges, with guards, a coach, Champion Solenne and the legendary Zenithar.
- **Rainbow creatures** are the rarest of all. They only appear in daytime, their colours shimmer, and a message tells you when one is nearby.
- **Evolution**: 61 creatures evolve when they reach a certain level, for example Ampup → Thunderwolf, Moonhop → Lunaroo and Drumbo → Bongorilla.
- **Starter choice**: Emberpup (fire), Sproutle (grass) or Bubbuck (water). Each one evolves at level 16.
- **Turn-based battles** that play out in the world. They include a type-effectiveness chart, same-type bonus, critical hits, priority moves, move effects (see **Moves** below), switching and running away. Your whole team shares the XP.
- **Moves**: 123 moves, at least 4 for every type, and every creature also learns moves from a second type. The buttons say what each move does. When a creature with 4 moves wants to learn a new one, you pick which move to forget (or say "Don't learn"). Older creatures get the new moves one at a time as they level up.
- **Catching**: throw Capture Cubes at wild creatures. Your odds are better when the target has low HP. You start with 10 cubes and find more by winning battles or breaking leaves.
- **Progression**: XP, level-ups, learning new moves and evolution. Your team holds up to 6 creatures; extra catches go to a storage box, where you can sort them (newest, level, name, type), show one type at a time, or let a creature go back to the wild (the Creature Book still remembers it).
- **Creature Book**: press **C** (or the Book button). Every creature you meet in a battle shows its picture, name and type; the ones you haven't met are black shapes. Catch one to fill in its whole page: where it lives, how it evolves, its moves and what it is strong or weak against. It works like a little wiki: tap a creature's name or picture on the team screen to open its page, tap a move to see what it does and who learns it, and tap a type to see all creatures of that type and what it beats. **‹ Back** goes back one page (or back to your team).
- **Attack animations**: every type has its own little animation (fire embers, water bubbles, sparks, music notes, rattling bones...), the fourteen signature moves have special ones, and moves that heal, boost, lower or put to sleep show it too. Turn them off with **Effects** on the pause screen if your device feels slow.
- **Sound effects**: soft, short sounds for building, battles, catching and badges. Sound-type creatures have their own tunes (Dinglet rings, Gongolin goes BONG, Drumbo drums), their moves sound special, and in the wild they sing every few seconds when you are near, with music notes floating up so you can spot them. Turn them off with the **Sound** button on the pause screen.
- **Weather** changes every few minutes and depends on where you are: rain, thunderstorms, snow in cold places, sandstorms in the desert (bones peek out of the sand), misty swamp mornings, shooting stars on clear nights, and a rainbow after rain. Each kind brings out more of some creatures: storms bring electric ones, rain water ones, snow ice ones, and rainbows make rainbow creatures much easier to find, and shooting stars bring aliens as well as cosmic creatures. Slime creatures love rain, paper creatures hide indoors when it rains or storms, sky creatures ride the storm winds, and light and sky creatures visit the rainbow.
- **Auto-save** to this device, plus **online saves** when you sign in (see below). This saves your world edits, team, badges, cubes and position.

Creatures farther from the starting point are higher level. Your team slowly regains HP outside of battle.

## Moves

Every move has one small effect at most. The battle buttons say what a move does.

| Move effect | What it does |
| --- | --- |
| Heals you | Gets back half of your HP (Rest Up, Sap Sip, Shimmer, Goo Patch, Rewind) |
| Raises your attack / defence | One step up, up to 3 steps (Pump Up, Hunker Down, Deep Focus, Iron Wall, Lie Low, Firewall) |
| Lowers the foe's attack / slows the foe | One step down (Grumble, Silk Wrap, Chill Wind, Ink Splat...). "May" means it only sometimes works |
| May make the foe flinch | If you move first, the foe may lose its move (a few moves, like Fast Forward, always go first) |
| Puts the foe to sleep | The foe skips one move (Lullaby, Sweet Dreams, Big Bong, Snooze). Sleepy creatures are easier to catch |
| Hits 2 to 4 times | Several small hits (Seed Volley, Rivet Shot, Meteor Shower, Confetti, Rapid Click) |
| Hurts you a little too | A big hit with a little recoil. It never knocks you out (Inferno Dash, Drake Charge) |
| Never misses | Always hits (Mind Trick, Color Splash and the special moves) |

Stat changes and sleep go away when a creature is switched out. A few creatures learn a **special move** (Blazehound, Tidalord, Grovebeast, Gongolin, Kitegale, Slimperor, Lumitower, Origrane, Clangalarm, Statuo and Pixbit 2.0 at Lv 30, Zenithar at Lv 45). Some moves were renamed to original names (Bump, Belly Bash, Cinder, Bubble Pop, Zap, Blaze Burst, Snow Storm, Nibble, Shadow Dash). Player battles need both players to have the latest version of the game.

## Types

| Type | Strong against | Notes |
| --- | --- | --- |
| Normal | — | Can't hit ghosts at all; bones bounce its bonks, and aliens surprise it |
| Fire | Grass, ice, bug, metal | |
| Water | Fire, rock, bone, cyber | Soggy bones, and water shorts out cyber creatures |
| Grass | Water, rock | |
| Electric | Water, sound, alien | Zaps break space gadgets, but bones don't carry zaps |
| Rock | Fire, electric, ice, bug | |
| Ice | Grass, bug, drake | |
| Bug | Grass, mind, time, cyber | A bug in the clockwork, a bug in the computer |
| Ghost | Ghost, mind, rainbow, cosmic | Can't hit normal creatures |
| Mind | Toxic, drake, cosmic | Psychic powers |
| Metal | Ice, rock, pixie | Very tough; toxic attacks don't affect it |
| Toxic | Grass, pixie | Can't hurt metal; bones have no tummy to upset |
| Pixie | Drake, ghost | Drake attacks don't affect it |
| Drake | Drake, bone | Powerful dragons, resist fire, water, grass and electric; they love chewing bones |
| Rainbow | Ghost, toxic, mind | Very rare |
| Cosmic | Rock, drake, sound, time | Stars and space (space bends time); come out at night |
| Sound | Ice, bug, mind, alien, camo | Loud and musical; alien ears are super sensitive and an echo finds a hiding camo creature |
| Bone | Ghost, electric, alien | Skeletons aren't scared of ghosts, a bone bonk breaks a battery, and aliens have never seen a skeleton. Weak to water and drake |
| Alien | Normal, metal, toxic | Ordinary creatures have never seen a spaceship, tractor beams lift metal, and aliens slurp up goo for science. Weak to bone, electric and sound |
| Sky | Fire, paper, pixie | Wind blows out flames and blows paper and little pixies away. Weak to electric, ice and slime (sticky goo glues wings) |
| Slime | Metal, sky, sound | Goo gunks up gears, glues wings and muffles sound. Weak to grass, light (sunshine dries it up) and paper (like a paper towel) |
| Light | Ghost, slime, cosmic, camo | Light chases away ghosts, dries up slime, spots camo creatures and outshines the stars. Weak to toxic (smog), cosmic (black holes gobble light) and paper (a lampshade) |
| Paper | Rock, slime, light | Paper covers rock, soaks up slime and blocks the light. Weak to fire, metal (scissors) and sky (wind) |
| Time | Metal, paper, slime | Old paper crumbles, metal rusts and slime dries up over time. Weak to bug (a bug in the clockwork) and cosmic (space bends time). Time attacks don't do much to other Time, cosmic or ghost creatures |
| Camo | Bug, mind | Camo sneaks up on bugs, and minds can't find it. Weak to light (it gets spotted) and sound (an echo finds it). Normal, grass and mind attacks have a hard time hitting it, and metal and light creatures shrug off its attacks |
| Cyber | Metal, mind, paper | Cyber hacks metal and minds and goes paperless. Weak to water (it shorts out) and bug (computer bugs crash it). Electric attacks barely hurt it |

Cosmic beats sound, sound beats mind, and mind beats cosmic. Sky beats paper, paper beats light, light beats slime, and slime beats sky. Mind and cosmic attacks are weak against aliens (space is their home).

## Gyms and badges

There are 25 gyms scattered around the map, one for each type except normal. The later ones are special: the **Fossil Gym** and the **Goo Gym are deep inside caves** (follow the arrow to the stone arch and walk down the stairs), the **Cloud Gym** and the **Saucer Gym float high in the sky**: find the blue (Cloud) or green (Saucer) pad on the ground below, build a tower of blocks on it and jump across. Two gyms only open at night: the stargazers of the **Comet Gym** (with star hats) and the aliens of the **Saucer Gym** (green and purple, with antennae; their flying saucer lands on the roof). By day the arrow skips them and tells you they open at night. The three newest gyms are in the new land (east and south of the old map) and each has its own trick: the **Clock Tower** has doors that only open at certain times of the day (look at the big 24-hour clock on its front), the **Hidden Hill** is a hill with no arrow once you get close (look for a door behind a bush; its trainers hide as stone pillars), and the **Firewall Maze** has three rooms of laser walls (step on a switch to turn off the lasers of its colour, press the green reset button if you get mixed up, and a friend can open the purple lanes by standing on a friend pad). Each gym is a building with a roof in its type's colour. **Gym walls are too strong to break, and you can't build inside a gym** (building next to one is fine). The closer a gym is to the start, the easier it is:

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
| 13 | Comet Gym (only at night) | Cosmic | Leader Nova | 24–26 |
| 14 | Phantom Gym | Ghost | Leader Raven | 25–27 |
| 15 | Scale Gym | Drake | Leader Wyvern | 26–28 |
| 16 | Prism Gym | Rainbow | Leader Aurora | 27–30 |
| 17 | Fossil Gym (in a cave) | Bone | Leader Digby | 28–30 |
| 18 | Saucer Gym (only at night) | Alien | Leader Zeeb | 29–31 |
| 19 | Sunbeam Gym (a lighthouse house on a sunny hill) | Light | Leader Lumi | 30–32 |
| 20 | Origami Gym (a paper lantern house) | Paper | Leader Kami | 30–32 |
| 21 | Goo Gym (in a cave) | Slime | Leader Gelda | 31–33 |
| 22 | Cloud Gym (floating in the sky: build a tower of blocks to reach it) | Sky | Leader Wren | 31–33 |
| 23 | Clock Tower (doors open by time of day) | Time | Leader Tikka | 32–33 |
| 24 | Hidden Hill (find it yourself!) | Camo | Leader Sylva | 35–36 |
| 25 | Firewall Maze (three laser rooms) | Cyber | Leader Ada | 39–40 |

Inside each gym is one apprentice trainer (two in the three newest gyms) you must beat before the Gym Leader will battle you. Trainer battles use 2–3 creatures in a row, and you can't catch their creatures or run away. Beating a leader earns that gym's badge and 5 Capture Cubes. Collect all 25 to open the Champion's Tower.

The top-right corner shows your badges and points you to the next gym. Catch creatures that have a type advantage before each one. **Healer Hana**, standing next to your starting point, fully heals your team.

## Champion's Tower

After you collect all 25 badges, the **Champion's Tower** opens. It is a tall stone tower with a rainbow roof and a glowing crystal on top, near the middle of the map (the arrow in the top-right corner shows the way). Inside:

- **Nurse Poppy** heals your team. **Coach Dex** trains you with 3 creatures at your best level and gives **double XP** (and 1 Capture Cube) every time.
- **Guard Bram** (Lv 41–43) and **Guard Opal** (Lv 42–44) must be beaten first, one after the other.
- **Champion Solenne** has 6 creatures (Lv 43–47). Her last one is **Zenithar**, a one-of-a-kind rainbow guardian. It can't be caught, and it **powers up** when it is down to half its health!
- If you win, you become the **Champion**: you get 20 Capture Cubes, a gold "Champion" title on the screen, and the win is saved. You can challenge Solenne again any time (her creatures are 3 levels stronger).
- If you lose, you wake up at the start, with a hint. Heal with Nurse Poppy and train with Coach Dex, then try again.
- After 16 badges, wild creatures are also 10 levels stronger, so there is always something to train against.
- Champions keep their title, but the tower waits until they have every badge again.

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
| `src/gymlive.js`, `src/daytime.js` | Parts of a gym that change while you play (the Clock Tower's doors, the Firewall Maze's lasers) and the Clock Tower's times of day |
| `src/clocktower.js`, `src/hiddenhill.js`, `src/firewall.js` | The Clock Tower, Hidden Hill and Firewall Maze gyms (building and live parts) |
| `src/creatures.js` | Wild creature spawning and wandering AI |
| `src/battle.js` | Battle flow, animations, catching |
| `src/ui.js` | HUD, team screen, creature portraits |
| `src/touch.js` | Tablet controls: joystick, drag-to-look, tap-to-interact, buttons |
| `src/cloud.js` | Accounts, online saves and the live channel for playing together (Supabase) |
| `src/multiplayer.js` | Play together: sharing a world, other players' avatars, block syncing |
| `src/duel.js` | Battles between players: asking, answering, swapping each turn's choices |
| `src/caves.js` | Caves: tunnels carved from the world seed, the second layer of big halls, wide tunnels and lit stairways (`carveBigCaves`), the stairway planner/builder, glowing decorations, treasure chests, and the darkness/light shader |
| `src/weather.js` | Weather: rain, storms, snow, sandstorms, fog, rainbows, and the creature spawn boosts they bring |
| `src/fx.js`, `src/fxrecipes.js` | Battle attack animations (engine and one recipe per type / signature move) |
| `src/spawnrules.js` | Spawn conditions as data: day, night, sunrise and sunset (Time creatures) and "a friend close by" (Cyber creatures) |
| `src/disguise.js` | Draws a Camo creature as a world block that blinks now and then |
| `src/sound.js` | Small sound effects made with Web Audio (no sound files) |

All creatures, names and art are original. To add a creature, add an entry to `SPECIES` in `src/species.js` and list it in a biome in `SPAWNS`. To change a gym, edit its entry in `src/gyms.js`.
