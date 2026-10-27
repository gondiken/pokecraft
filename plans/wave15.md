# Wave 15 · Picture Worlds 2: shared rules for the five tasks

Read `CLAUDE.md`, `ROADMAP.md` "Wave 15", `STORY.md` "The Picture Worlds" and `plans/T40.md` (the Picture World base)
first. The five tasks run side by side in their own worktrees and are merged one after the other, so each one keeps
to its own ids, names and sections below.

| Task | Picture World | Type id | Frame / where | Wool id | Block ids (incl. wool) |
| --- | --- | --- | --- | --- | --- |
| T41 | Atlantis, the Sunken City (in the Pirate Seas, `plans/T41.md`) | `atlantis` | `secret2` -> `atlantis` | 204 | 204-214 |
| T42 | the Portal House (in the Swirl itself, no frame) | `portal` | `portal` (`door: false`) | 215 | 215-223 |
| T43 | the Funfair (Playland zone `fair`) | `funfair` | `fair` | 224 | 224-234 |
| T44 | the Room of Doors | `surprise` | `doors` | 235 | 235-243 |
| T45 | Doodle, the Sketchbook | `doodle` | `secret1` -> `doodle` | 244 | 244-249 |

- **Block ids are a `Uint8Array`: 255 is the last id.** 250 is `HOUSE_PROP`; 251-255 stay free for the merge (ask the
  orchestrator). Stay inside your range; reuse old blocks (and `setLive` with old ids) where you can.
- **Tiles:** new tile names get your task's prefix (e.g. `AT_`, `PO_`, `FF_`, `SU_`, `DO_`) and are appended to
  `MORE_TILES` in your own commented block (the atlas has room for 1024). Never compute tile places by hand.
- **Type chart:** add your own `EFFECTIVENESS.<type>` row and `TYPE_COLORS` entry. Entries in *other* types' rows
  (how others hit you) go in your own section as separate lines (`EFFECTIVENESS.cyber.atlantis = 2;`), never by editing
  another row, so five merges never meet in the same line. Never change an old cell (the old chart stays as it is).
- **Species, moves, shapes, fx, sounds:** your own `/* ==== T4x <type> ==== */` sections, like wave 14. Shape, move,
  sound and species ids must be new and must not clash with the other four tasks: prefix doubtful ones. Never name a
  move like a sound. 7 creatures, 3+ own shapes, a `gear` mesh that every model of the type wears.
- **Levels:** wild `levelBonus` 33 / `levelCap` 45 from `pictureRealm`; Boss top level 62-65 (the easy side), crews
  59-63. `REMATCH_CAP` stays 70.
- **Realms / Picture World base:** a new realm id for your own world only (T44 `doors`, T45 `doodle`); T41 grows
  `pirate`, T42 adds the Portal House to the Swirl (`REALMS.swirl.version` 5, only T42 changes Swirl terrain), T43 fills
  `PLAYLAND_PARTS.fair` (writes only inside `ZONES.fair.box`, opens the fair gate). Flip only your own frame's `ready`.
  The Boss is one `addBoss` in `pictureboss.js`.
- **Old specs that count things** (types, species, tiles, blocks, frames ready, bosses) must count in a way that
  survives the other four merges (`>=`, or the count from the data), not a new hard number.
- **Docs:** add your rows to the CLAUDE.md code map and a Key ideas paragraph, the README type / world rows. The
  orchestrator does the wave wrap-up (ROADMAP, totals, Coach Dex, the type count line in CLAUDE.md).
- **`WORLD_VERSION`** is not touched (no main-world blocks change). Duel `VERSION` only if battle rules change.
- **Child-friendly words**, no Pokémon names, iPad: every action works with the one action button (`near` / `use` /
  `holds` / `release` hooks), skill games are never a fail.
- Spec named after the type (`tests/specs/<type>.mjs`), screenshots `t4x-*.png`, runnable alone (`node run.mjs <type>`).

## Merge notes (orchestrator)

- **Chart retune at the merge** (a defender is weak to at most 5 types, 6 for mind / ghost / drake, the `four-types` /
  `two-types` rule): the five new rows together hit mind, cyber, time and camo too often, so the new rows changed (old cells
  untouched): Funfair `{ cozy, normal, rainbow }` (was time, camo, cozy), Surprise `{ ninja, pirate, dream }` (was mind,
  ninja, cyber), Doodle `{ camo, tiny, sky }` (was camo, cyber, time); Atlantis keeps `{ pirate, camo, time }`. The spec
  exclusions and loosened limits the builders added to get around it are gone. Portal (T42) must fit into what is left.
- `fxrecipes.js` came out of the T41 merge with an unclosed block (keep-both of two appended sections); rebuilt from the
  branches. Check every merged file as an ES module (`node --check` on a `.mjs` copy: plain `.js` is parsed as a script).
