# PokeCraft

A browser game that mixes a Minecraft-style voxel world with creature collecting.
Explore a procedurally generated block world, build and dig, and battle and catch
wild creatures in Capture Cubes.

Built with plain JavaScript and [three.js](https://threejs.org/). There is no build step.

## Running it

ES modules must be served over HTTP, so opening `index.html` directly will not work. From the repo root:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000> in a desktop browser.

The game is fully static, so it also works on GitHub Pages: enable Pages for the branch and open the URL.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Space | Jump / swim up |
| Shift | Sprint |
| Mouse | Look |
| Left click | Break block, or start a battle with the creature under the crosshair |
| Right click | Place the selected block |
| 1–8 / mouse wheel | Pick a block from the hotbar |
| E | Battle the targeted creature |
| P / Tab | Team & storage screen |
| Esc | Pause |

## Features

- **Voxel world**: a 128×128 terrain with hills, mountains, lakes, beaches and forests, plus a day/night cycle. Break and place 8 block types.
- **11 original creatures** across 6 types (normal, fire, water, grass, electric, rock). Each lives in its own biome: Fluffin graze the plains, Pebblor sit on mountaintops, Bubbuck swim in lakes, and so on.
- **Starter choice**: Emberpup (fire), Sproutle (grass) or Bubbuck (water). Each one evolves at level 16.
- **Turn-based battles** that play out in the world. They include a type-effectiveness chart, same-type bonus, critical hits, priority moves, switching and running away.
- **Catching**: throw Capture Cubes. Your odds are better when the target has low HP. You start with 10 cubes. You can find more by winning battles or breaking leaves.
- **Progression**: XP, level-ups, learning new moves and evolution. Your team holds up to 6 creatures; extra catches go to a storage box.
- **Auto-save** to `localStorage`. This saves your world edits, team, cubes and position.

Creatures farther from the starting point are higher level. Your team slowly regains HP outside of battle.

## Code layout

| File | Purpose |
| --- | --- |
| `src/main.js` | Renderer, input, game loop, save/load, title screen |
| `src/world.js` | Terrain generation, block storage, chunk meshing, voxel raycast |
| `src/blocks.js` | Block definitions and the procedurally drawn pixel-art texture atlas |
| `src/player.js` | First-person movement and collision |
| `src/species.js` | Types, moves, species data, stats/XP, blocky creature models |
| `src/creatures.js` | Wild creature spawning and wandering AI |
| `src/battle.js` | Battle flow, animations, catching |
| `src/ui.js` | HUD, team screen, creature portraits |

All creatures, names and art are original. To add a creature, add an entry to `SPECIES` in `src/species.js` and list it in a biome in `SPAWNS`.
