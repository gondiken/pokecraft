# PokeCraft

A browser game that mixes a Minecraft-style voxel world with creature collecting.
Explore a procedurally generated block world, build and dig, battle and catch
wild creatures in Capture Cubes, and beat all 14 Gym Leaders to collect every badge.

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
| E | Battle the targeted creature, or talk to a person |
| P / Tab | Team & storage screen |
| Esc | Pause (Resume, Main menu, Play together) |

On a tablet:

| Touch | Action |
| --- | --- |
| Left joystick | Walk (push all the way to run) |
| Drag on the right side | Look around |
| Tap a creature or person | Battle it, or talk to them |
| Battle / Challenge / Heal button | Same as tapping the creature or person under the crosshair |
| Break / Place / Jump buttons | Break or place a block at the crosshair, jump or swim up |
| Tap the hotbar | Pick a block |
| Team / II buttons | Team screen / pause |

## Features

- **Voxel world**: a 192×192 terrain with hills, snowy peaks, lakes, beaches and forests, plus a day/night cycle. Break and place 9 block types.
- **60 original creatures** across 15 types (see below). Each lives in its own biome: Fluffin graze the plains, Frostling hop around the snowy peaks, Ripplet swim in lakes, Clanklet roam the mountains, and ghost-type creatures only come out at night.
- **Rainbow creatures** are the rarest of all. They only appear in daytime, their colours shimmer, and a message tells you when one is nearby.
- **Evolution**: 18 creatures evolve when they reach a certain level, for example Ampup → Thunderwolf, Scalekin → Scalewing and Prismkit → Spectrion.
- **Starter choice**: Emberpup (fire), Sproutle (grass) or Bubbuck (water). Each one evolves at level 16.
- **Turn-based battles** that play out in the world. They include a type-effectiveness chart, same-type bonus, critical hits, priority moves, switching and running away. Your whole team shares the XP.
- **Catching**: throw Capture Cubes at wild creatures. Your odds are better when the target has low HP. You start with 10 cubes and find more by winning battles or breaking leaves.
- **Progression**: XP, level-ups, learning new moves and evolution. Your team holds up to 6 creatures; extra catches go to a storage box.
- **Auto-save** to this device, plus **online saves** when you sign in (see below). This saves your world edits, team, badges, cubes and position.

Creatures farther from the starting point are higher level. Your team slowly regains HP outside of battle.

## Types

| Type | Strong against | Notes |
| --- | --- | --- |
| Normal | — | Can't hit ghosts at all |
| Fire | Grass, ice, bug, metal | |
| Water | Fire, rock | |
| Grass | Water, rock | |
| Electric | Water | |
| Rock | Fire, electric, ice, bug | |
| Ice | Grass, bug, drake | |
| Bug | Grass, mind | |
| Ghost | Ghost, mind, rainbow | Can't hit normal creatures |
| Mind | Toxic, drake | Psychic powers |
| Metal | Ice, rock, pixie | Very tough; toxic attacks don't affect it |
| Toxic | Grass, pixie | Can't hurt metal |
| Pixie | Drake, ghost | Drake attacks don't affect it |
| Drake | Drake | Powerful dragons, resist fire, water, grass and electric |
| Rainbow | Ghost, toxic, mind | Very rare |

## Gyms and badges

There are 14 gyms scattered around the map, one for each type except normal. Each gym is a brick building with a roof in its type's colour. The closer a gym is to the start, the easier it is:

| # | Gym | Type | Leader | Leader's levels |
| --- | --- | --- | --- | --- |
| 1 | Boulder Gym | Rock | Leader Rocco | 6–8 |
| 2 | Hive Gym | Bug | Leader Mantis | 8–10 |
| 3 | Swamp Gym | Toxic | Leader Venna | 10–12 |
| 4 | Tide Gym | Water | Leader Marina | 12–14 |
| 5 | Twinkle Gym | Pixie | Leader Luma | 14–15 |
| 6 | Grove Gym | Grass | Leader Fern | 15–17 |
| 7 | Volt Gym | Electric | Leader Sparky | 17–19 |
| 8 | Iron Gym | Metal | Leader Forge | 19–21 |
| 9 | Mystic Gym | Mind | Leader Sage | 20–22 |
| 10 | Blaze Gym | Fire | Leader Cinder | 22–24 |
| 11 | Frost Gym | Ice | Leader Yuki | 23–25 |
| 12 | Phantom Gym | Ghost | Leader Raven | 25–27 |
| 13 | Scale Gym | Drake | Leader Wyvern | 26–28 |
| 14 | Prism Gym | Rainbow | Leader Aurora | 27–30 |

Inside each gym is an apprentice trainer you must beat before the Gym Leader will battle you. Trainer battles use 2–3 creatures in a row, and you can't catch their creatures or run away. Beating a leader earns that gym's badge and 5 Capture Cubes. Collect all 14 to become the Champion.

The top-right corner shows your badges and points you to the next gym. Catch creatures that have a type advantage before each one. **Healer Hana**, standing next to your starting point, fully heals your team.

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

A visitor's own world is untouched. **Go back to my world** returns them to it, and that happens automatically if the host stops sharing or leaves. The connection uses Supabase Realtime. Neither player needs to be signed in, but both need an internet connection.

For testing on one computer, add `?mp=local` to the address. Tabs in the same browser then connect to each other directly, without the server.

## Code layout

| File | Purpose |
| --- | --- |
| `src/main.js` | Renderer, input, game loop, save/load, title screen |
| `src/world.js` | Terrain generation, block storage, chunk meshing, voxel raycast |
| `src/blocks.js` | Block definitions and the procedurally drawn pixel-art texture atlas |
| `src/player.js` | First-person movement and collision |
| `src/species.js` | Types, moves, species data, stats/XP, blocky creature models |
| `src/gyms.js` | Gym, leader and trainer data |
| `src/npc.js` | Blocky people: trainers, leaders and the healer |
| `src/creatures.js` | Wild creature spawning and wandering AI |
| `src/battle.js` | Battle flow, animations, catching |
| `src/ui.js` | HUD, team screen, creature portraits |
| `src/touch.js` | Tablet controls: joystick, drag-to-look, tap-to-interact, buttons |
| `src/cloud.js` | Accounts, online saves and the live channel for playing together (Supabase) |
| `src/multiplayer.js` | Play together: sharing a world, other players' avatars, block syncing |

All creatures, names and art are original. To add a creature, add an entry to `SPECIES` in `src/species.js` and list it in a biome in `SPAWNS`. To change a gym, edit its entry in `src/gyms.js`.
