# T4a · Two new types (Bone, Alien), their creatures and gyms (plan)

Owner's words: "We'll add two more creature types first: Bone (skeletons and stuff) and alien. You need
to build this and then build gym for each too. champion now needs to complete these new gyms too.
Expand the map a bit more if you need to." (T4b later adds a 7th creature to all 19 types; shiny
creatures are cancelled. Not planned here, but spawn tables keep room for it.)

Result: 19 types, 87 moves (+10), **114** normal species (19 × 6, +12; the "108" in the brief was a
miscount) + Zenithar, **18 gyms**, Champion's Tower needs 18 badges. **The map stays 224×224**: there is
room (measured below), and growing it would move every old gym (`gymSpots` scales with `WORLD_W`
and sorts by distance to the middle).

## 1. Types
| id | display | `TYPE_COLORS` | wool RGB (`blocks.js`) |
| --- | --- | --- | --- |
| `bone` | BONE | `'#e9e0c9'` (ivory) | `[236, 228, 205]`, with darker "crack" pixels `(x*5+y*3)%19===0 → [150,140,120]` |
| `alien` | ALIEN | `'linear-gradient(90deg,#8dff6a,#b98cff)'` (green → purple) | `[140, 225, 90]`, purple dots `(x*11+y*7)%17===0 → [170,110,230]` |

All `TYPE_COLORS` users are CSS backgrounds, so a gradient is fine (cosmic and rainbow already use one).
The chip text shows the type id in upper case like the others.

**Effectiveness** (new rows, plus new entries in existing rows):
```js
bone:  { ghost: 2, electric: 2, alien: 2, metal: 0.5, grass: 0.5 },
alien: { normal: 2, metal: 2, toxic: 2, cosmic: 0.5, alien: 0.5 },
// added to existing rows:
water: { ..., bone: 2 },        // soggy bones
drake: { ..., bone: 2 },        // drakes love to chew bones
electric: { ..., bone: 0.5, alien: 2 }, // bones don't carry zaps; zaps break space gadgets
sound: { ..., alien: 2 },       // alien ears are super sensitive
normal: { ..., bone: 0.5 },     // bonks bounce off hard bone
toxic: { ..., bone: 0.5 },      // no tummy to upset
cosmic: { ..., alien: 0.5 },    // space is their home
mind: { ..., alien: 0.5 },      // big alien brains block mind tricks
```
Kid reasons (for README notes / Book): Bone beats ghosts ("skeletons aren't scared of ghosts"),
electric ("a bone bonk breaks the battery") and aliens ("aliens have never seen a skeleton!").
Alien beats normal ("ordinary creatures have never seen a spaceship"), metal (tractor beams lift
metal) and toxic (they slurp up goo for science). Balance: Bone 3 strengths / 2 weaknesses
(water, drake) / 3 resists; Alien 3 strengths / 3 weaknesses (bone, electric, sound) / 2 resists.
Normal gets its first weakness (alien); toxic goes from 2 to 3 weaknesses; nothing gains more than one.

**Moves** (`MOVES`, ids never collide with `sound.js` names; checked against the full list):
```js
bonebonk:    mv('Bone Bonk', 'bone', 40, 1),
bonetoss:    mv('Bone Toss', 'bone', 20, 1, { fx: { kind: 'multi', min: 2, max: 4 } }),
fossilcrush: mv('Fossil Crush', 'bone', 75, 0.9),
dinostomp:   mv('Dino Stomp', 'bone', 95, 0.85, { fx: { kind: 'flinch', chance: 0.2 } }),
rattledance: mv('Rattle Dance', 'bone', 80, 1, { fx: { kind: 'raise', stat: 'atk', chance: 0.5 }, sig: true }),
beepbeam:    mv('Beep Beam', 'alien', 40, 1),
tractorbeam: mv('Tractor Beam', 'alien', 55, 1, { fx: { kind: 'lower', stat: 'spd', chance: 0.5 } }),
ufoblast:    mv('UFO Blast', 'alien', 75, 0.9),
gravityflip: mv('Gravity Flip', 'alien', 90, 0.9, { fx: { kind: 'flinch', chance: 0.2 } }),
mothership:  mv('Mothership', 'alien', 90, 1, { sure: true, sig: true }),
```
`T1.bone='bonebonk'`, `T2.bone='fossilcrush'`, `T3.bone='bonetoss'`, `T4.bone='dinostomp'`, `UTIL.bone='hunker'`;
`T1.alien='beepbeam'`, `T2.alien='ufoblast'`, `T3.alien='tractorbeam'`, `T4.alien='gravityflip'`, `UTIL.alien='pumpup'`.
`L(type, second)` then works unchanged for both, and any older type may use bone/alien as `second`.
`moveInfo` needs nothing new (all fx kinds exist). Do **not** add the new ids to `OLD_MOVE_IDS`.

**Weather** (`weather.js` `BOOSTS`): `sandstorm: { rock: 2.5, fire: 1.5, bone: 1.5 }` (bones peek out
of the sand), `fog: { ghost: 3, toxic: 2, bone: 1.5 }`, `stars: { cosmic: 2, alien: 1.5 }` (visitors
ride shooting stars). Keep alien at 1.5 and alien peak night weight ≤ 2: the `weather` spec needs the
cosmic share on a starry peak to rise ×1.3 (computed: ×1.40 with these numbers, ×1.31 if alien were ×2
with weight 3).

**Duel**: `duel.js` `VERSION` 2 → 3 (new types, moves and species change battle results).

## 2. Creatures (12: three 2-stage families per type, like cosmic and sound)
Each family gets a NEW builder in `shapes.js` (added to `SHAPES`): bone `skull`, `bonedog`, `dino`;
alien `ufo`, `visitor`, `tripod` → 3 shapes per type. Evolutions share their family's shape with
extras. Friendly, never scary: round shapes, big glowing pupils, smiles.

| id | name | evolves | base hp/atk/def/spd | baseXp, catch | learn | flags |
| --- | --- | --- | --- | --- | --- | --- |
| skullop | Skullop | → skullossal @22 | 45/55/60/50 | 64, 0.45 | `L('bone','ghost')` | |
| skullossal | Skullossal | | 80/95/95/60 | 160, 0.12 | `L('bone','ghost')` | |
| rattlepup | Rattlepup | → howlbone @22 | 50/60/45/70 | 66, 0.4 | `L('bone','normal')` | |
| howlbone | Howlbone | | 80/100/70/100 | 165, 0.12 | `L('bone','normal',[[30,'rattledance']])` | |
| dinobit | Dinobit | → stompasaur @24 | 55/60/65/40 | 70, 0.4 | `L('bone','rock')` | |
| stompasaur | Stompasaur | | 95/105/90/50 | 170, 0.1 | `L('bone','rock')` | |
| saucerling | Saucerling | → ufomax @22 | 45/50/50/70 | 66, 0.4 | `L('alien','electric')` | `flies` |
| ufomax | Ufomax | | 75/90/80/100 | 165, 0.12 | `L('alien','electric',[[30,'mothership']])` | `flies` |
| blipling | Blipling | → blipstar @22 | 45/55/45/60 | 64, 0.45 | `L('alien','mind')` | |
| blipstar | Blipstar | | 80/95/70/90 | 160, 0.12 | `L('alien','mind')` | |
| podlet | Podlet | → tallipod @24 | 55/50/65/40 | 66, 0.4 | `L('alien','toxic')` | |
| tallipod | Tallipod | | 90/90/85/75 | 165, 0.12 | `L('alien','toxic')` | |

Descriptions (short, for the Book):
- Skullop: "A happy little skull that hops around clacking its jaw, as if it is always laughing."
- Skullossal: "A giant skull with a bony crown. It rolls down hills and giggles all the way."
- Rattlepup: "A skeleton puppy. It wags its bony tail so hard that it rattles."
- Howlbone: "A loyal skeleton hound. It guards old ruins and howls a song at the moon."
- Dinobit: "A tiny fossil dino that hatched from a stone egg. It still wears a bit of the shell."
- Stompasaur: "A huge dinosaur skeleton from long, long ago. It stomps gently so nobody gets scared."
- Saucerling: "A tiny flying saucer. A shy green pilot peeks out of the glass bubble."
- Ufomax: "A big saucer with a gentle beam. It lifts lost toys back to their owners."
- Blipling: "A little visitor from space with three eyes. It says 'blip!' to say hello."
- Blipstar: "It leads little visitors on trips across the stars. Its ray gun only blows bubbles."
- Podlet: "A wobbly space pod that landed in a crater. Its eyes pop up on stalks to look around."
- Tallipod: "It walks on three long legs to peek over the trees. It collects shiny pebbles."

**Models** (`model: { shape, scale, body, accent, dark, belly, extras }`; hooks are the existing
`parts.bounce/hover/float/legs/arms/tail/head/wings`, `swing()`/`spin()` in shapes.js):
- `skull` — Skullop (scale 0.75, body 0xf2ead6, accent 0x7fe0ff, dark 0x3a3040, belly 0xe0d6bc, extras []);
  Skullossal (1.25, 0xe8dcc0 / 0xffb84a / 0x2a2030 / 0xd8ccb0, ['crown','horns']). Body pivot =
  `parts.bounce` (hops). Cranium: `ball(r 0.38)` at y 0.6 plus a flat top box; face plate in front;
  two dark square eye sockets (0.16×0.18) each with a small glowing accent pupil (`glow`, `userData.eye`);
  a tiny upside-down nose; a **jaw pivot** (0.5×0.12×0.4, belly colour, 4 white teeth) with
  `swing(parts, jaw, 'x', 0.25, 6)` so it clacks; two little bone feet (bar + round knobs).
  `crown`: 3 bone spikes and a glowing gem on top; `horns`: two curved bone horns.
- `bonedog` — Rattlepup (0.85, 0xf4ecd8, red collar accent 0xe04a4a, 0x4a3a30, 0xd8ccb0, []);
  Howlbone (1.3, 0xe6dcc4, blue 0x4a7ae0, 0x2a2228, 0xcfc2a4, ['bandana','spines']). A long thin spine
  bar; 3 rib "U"s (two sides + bottom, gaps between ribs); hip block; 4 thin bone legs with knob
  knees/paws in `parts.legs` (phases like `buildQuad`); skull head on `parts.head` (box head, snout,
  dark sockets + glowing pupils, little pointy ears); collar ring in accent with a gold tag 0xffd84a;
  tail of 3 shrinking bone segments + knob on `parts.tail` (wags). `bandana`: accent triangle at the
  neck; `spines`: a row of small bones along the spine.
- `dino` — Dinobit (0.8, 0xeee2c4, mossy 0x8ad06a, 0x5a4a36, 0xffffff, ['shell']); Stompasaur (1.35,
  0xe0d0aa, amber 0xc0703a, 0x3a2e22, 0xf0e6d0, ['plates']). Two thick legs with 3 toe bones
  (`parts.legs`); a tilted spine with 4 rib bars a side; two tiny arms (`swing` small); neck + big skull
  on `parts.head` with a **lower jaw pivot** (slow open/close), white teeth, sockets + glowing pupils;
  tail of 5 shrinking segments on `parts.tail`. `shell`: jagged white eggshell cap on the head and a
  half shell round the bottom; `plates`: accent "fossil amber" plates down the back.
- `ufo` — Saucerling (0.75, silver 0xc8d0dc, green lights 0x7dff6a, 0x6a7080, pilot 0x8de060, []);
  Ufomax (1.3, 0xb0b8c8, pink 0xff6ad8, 0x4a5060, purple pilot 0xa070e0, ['beam','fins']). Body pivot
  `parts.bounce` + `parts.hover`. Wide flat disc (1.0×0.14×1.0) over a smaller dark one; a ring pivot
  with 8 glowing accent lights, `spin(parts, ring, 'y', 2)`; glass dome (0.5×0.36×0.5,
  `material.transparent = true, opacity 0.45`, pale blue) with the pilot inside: a small belly-coloured
  head with `eyes()` and two antenna nubs; 3 short landing legs. `beam`: 3 stacked shrinking
  translucent accent boxes under it (glow, opacity 0.35); `fins`: two tail fins.
- `visitor` — Blipling (0.75, 0x8de060, purple 0xc08cff, 0x3a6a2a, 0xd8ffc0, []); Blipstar (1.15,
  0x6ac850, 0xb070ff, 0x2a5a20, 0xc8f8b0, ['helmet','cape','raygun']). Small biped: short legs
  (`parts.legs`), body 0.4×0.4×0.3 with an accent belt and round badge, arms with 3-finger hands
  (`parts.arms`); a **big head** (0.6×0.5×0.5) on `parts.head` with **three eyes** (`eyes()` + a
  centre eye made the same way, all `userData.eye`) and a smile; two antennae pivots with glowing
  ball tips, `swing` on z in opposite phase. `helmet`: transparent glass box round the head; `cape`:
  accent cape; `raygun`: a little gun in one hand with a glowing bubble tip.
- `tripod` — Podlet (0.75, 0xa070e0, green spots 0x7dff6a, 0x5a3a8a, 0xd8c0ff, ['stubby']); Tallipod
  (1.1, 0x8a5ad0, 0x9dff7a, 0x4a2a7a, 0xc8b0f0, ['long']). An egg-shaped pod (`ball`) with glowing
  accent spots; two **eye stalks** (thin stalk + white eye with pupil) that `swing`; **three legs** at
  120° (each in a holder rotated by y, so `parts.legs` rotation.x swings it outwards). `stubby`: legs
  0.15 long, pod sits low; `long`: legs ~1.0 with knee knobs, pod at ~1.2, a tiny antenna.

**Spawns** (only add entries; weights moderate so T4b's creatures fit later):
- desert: `['rattlepup', 2], ['dinobit', 2], ['podlet', 1.5], ['skullop', 1.5, 'night'], ['saucerling', 0.8, 'night'], ['howlbone', 0.2], ['stompasaur', 0.15], ['skullossal', 0.15, 'night'], ['tallipod', 0.2, 'night']`
- cave: `['skullop', 2], ['dinobit', 1.5], ['rattlepup', 1], ['podlet', 0.5], ['skullossal', 0.15], ['stompasaur', 0.1]`
- swamp: `['skullop', 1.5, 'night'], ['rattlepup', 1, 'night']` · beach: `['dinobit', 0.8]` (fossils wash up)
- mountain: `['dinobit', 1], ['saucerling', 1, 'night'], ['podlet', 1, 'night'], ['tallipod', 0.15, 'night']`
- peak: `['saucerling', 1, 'night'], ['blipling', 0.8, 'night'], ['ufomax', 0.2, 'night']` (total ≤ 2, see weather)
- meadow: `['blipling', 1.5, 'night'], ['blipstar', 0.2, 'night']` · snow: `['blipling', 1, 'night']`
- plains: `['saucerling', 1, 'night'], ['blipling', 0.8, 'night'], ['rattlepup', 0.8, 'night']`

Every new creature is catchable directly or through its pre-evolution; bone ones are found in day
and night (desert, caves), alien ones mostly at night, with Podlet in the desert any time.

## 3. Gyms 17 and 18 (appended to `GYMS`)
**Appended, not inserted.** Badges are saved as gym **ids** (`game.badges.includes(gym.id)`), so old
badges stay right either way, but `placeGyms` gives `GYMS[i]` the i-th spot: inserting would swap
which type sits where in old worlds. Appending also matches "later gyms are tougher".

```js
{ id: 'bone', type: 'bone', name: 'Fossil Gym', badge: 'Fossil Badge',
  leader: { name: 'Leader Digby', colors: { shirt: 0xc8a86a, pants: 0x5a4630, hair: 0xd8d8d8, skin: 0xe8b98a } },
  trainer: { name: 'Fossil Fan Pia', colors: { shirt: 0xe0d8c0, pants: 0x6a5a40, hair: 0x8a4a2a, skin: 0xf2c79a } },
  trainerTeam: [['rattlepup', 27], ['skullop', 28]],
  leaderTeam: [['skullop', 28], ['dinobit', 29], ['howlbone', 30]],
  intro: ['Welcome to the Fossil Gym! Mind the bones, they are very old.', 'My bony buddies may rattle, but they never fall apart!'],
  lose: 'You dug up a win! The Fossil Badge is yours.' },
{ id: 'alien', type: 'alien', name: 'Saucer Gym', badge: 'Saucer Badge',
  leader: { name: 'Leader Zeeb', colors: { shirt: 0x8de060, pants: 0x4a2a7a, hair: 0xc08cff, skin: 0xf2d0b0 } },
  trainer: { name: 'Skywatcher Rin', colors: { shirt: 0x3a3a5a, pants: 0x2a2a3a, hair: 0x1a1a1a, skin: 0xc68a5a } },
  trainerTeam: [['blipling', 28], ['saucerling', 28]],
  leaderTeam: [['podlet', 29], ['blipstar', 30], ['ufomax', 31]],
  intro: ['Beep boop! Welcome to the Saucer Gym.', "My friends came from very far away. Let's give them a warm welcome!"],
  lose: 'Out of this world! The Saucer Badge is yours.' },
```
Levels: just above the Prism Gym (27–30) and kept gentle (28–30, 29–31).
Wool: append `'bone', 'alien'` to `WOOL_TYPES` → block ids **37, 38** (free; 39 and 49+ also free). Atlas
tile indices after the wool shift by 2; that's fine, tiles are not saved. Update the comment "20-36"
→ "20-38". The building is the same `buildGym` with the new roof colour.

### Placement (no map change; measured)
- `gyms.js`: `export const ORIGINAL_GYMS = 16;` (the gyms whose spots come from `gymSpots`).
- `world.js`:
  - `placeGyms()` places `GYMS.slice(0, ORIGINAL_GYMS)` with `gymSpots(ORIGINAL_GYMS)` exactly as now.
  - **`caves.js` keep-out must use `world.gymSpots(ORIGINAL_GYMS)`** (today `GYMS.length`: with 18 it
    would re-run the spot search, change every gym and every cave). Never call `gymSpots` with 18.
  - New `extraGymSpots()` (cached in `this.extraSpots`; terrain-only, so the same with or without caves):
    `taken = gymSpots(16)` as `{x,z}`, `[tx,tz] = towerSpot(taken)`; for each extra gym, scan
    `x, z` from 16 to `WORLD_W-16` step 2, skip if `hypot(x-cx, z-cz) < 40` or not dry (the same 5-point
    `terrainHeight > WATER_LEVEL` test as `towerSpot`), score = min(Chebyshev distance to the tower,
    Euclidean distance to every taken spot and earlier extra spot); keep the best (first wins ties).
    Fallback without the dry test if nothing is dry. Index 0 → `GYMS[16]` (bone), 1 → `GYMS[17]` (alien).
  - New `fillCavesNear(solid, x0, z0, R)`: restore `solid` in the box, delete `caves.opened` columns
    there, filter `floors/crystals/chests/entrances` (same as the tail of `fillCavesNearStart`; have
    `fillCavesNearStart` reuse it).
  - `generate()` order: terrain → `solid` → `carveCaves` → **`fillCavesNear(solid, x, z, 18)` for each
    extra spot** → `carved` snapshot → plants → `placeGyms()` (16) → `placeTower()` (sees only 16
    gyms, unchanged) → **`placeExtraGyms()`** (same door/floor/`buildGym`/`markLit`/positions code as
    `placeGyms`; factor a `placeGym(def, x, z)` helper; push onto `this.gyms`) → `fillCavesNearStart`.
    Filling before the plants keeps the caves:false and caves worlds identical there.
- Measured with a prototype of exactly this on a copy of `src/`:
  - 300 seeds: both new gyms are always ≥ **34.5** blocks from every old gym and the tower (median 45;
    the old gyms' own spacing is 36). Gym ground works reach 15 blocks out, so nothing overlaps.
  - 6 seeds, old code vs new: old gyms (x, z, y) and tower identical; **0 blocks differ outside the two
    37×37 boxes** round the new gyms. FNV-1a checksums of `world.data` skipping those boxes (both old
    and new code): seed 1 → `1681420519`, seed 4242 → `3236083087`.
  - 11 seeds: no cave changes within 14 of any gym (the `caves` spec rule), gyms the same with/without caves.
  - New gym spots: seed 1 → `[[206,164],[96,206]]`, seed 4242 → `[[16,118],[206,140]]`, seed 7 →
    `[[206,16],[146,206]]`, seed 42 → `[[68,124],[16,16]]`.
- Old saves: block edits inside a new gym's box (rare, far corners) still apply on top of it;
  `continueGame` already moves a player who would start inside a wall. A chest opened inside the box
  in an old save would show as an open chest in stone (acceptable, very rare).

## 4. Champion's Tower and progress
- `gyms.js` TOWER: `locked: n => \`Only trainers with all ${GYMS.length} badges may battle here. You have ${n}. Keep going, you can do it!\``;
  champion intro line `So you are the trainer with all ${GYMS.length} badges!`. Coach Dex gets one more
  team: `['howlbone', 'ufomax', 'stompasaur']`. Champion/guard teams unchanged.
- `main.js` `talkTower`: open if `game.badges.length >= GYMS.length || game.champion` (old champions
  keep their tower: rematch and Coach Dex; see decision 1). Comments "16" → "all".
- `main.js` level bonus: `game.creatures.levelBonus = game.badges.length >= ORIGINAL_GYMS || game.champion ? 10 : 0`
  (decision 2; no change for anyone who already had it). Update the `creatures.js` comment.
- Badge toast `(17/18)` comes from `GYMS.length` already. On reaching 18: champion → "You collected
  every badge! Champion Solenne would love a rematch."; otherwise the existing tower message.
- `continueGame` (and new game: no): if the save has all `GYMS.slice(0, 16)` badges but not all 18,
  toast once: "New gyms have appeared: the Fossil Gym and the Saucer Gym! Follow the arrow."
- Guide arrow: `world.gyms.find(no badge)` already walks `GYMS` order, so it points to Fossil, then
  Saucer, then the tower / "★ Champion! ★". Old champions keep `champion: true` and the HUD title.

## 5. UI and docs
- Badge HUD: 18 icons; set `#badges { max-width: 160px }` so they sit in 3 neat rows of 6 (now 7+7+4).
  Team-screen badge list (`#badge-list`) wraps already.
- Book filters come from `TYPE_COLORS` keys (20 buttons, they wrap); counts come from `SPECIES`. Nothing
  to change, but check the iPad screenshot.
- README: Features (19 types, 114 creatures, 52 evolve, 87 moves, 18 badges), Types table (new rows +
  changed rows: Normal "can't hit ghosts; aliens surprise it", Water +bone, Electric +alien, Drake +bone,
  Sound +alien), Gyms table rows 17–18 (Fossil Gym · Bone · Leader Digby · 28–30; Saucer Gym · Alien ·
  Leader Zeeb · 29–31), "Collect all 18", tower section (18 badges; wild +10 after 16).
- CLAUDE.md: Bone and Alien are our own types; species.js "87 moves", "114 normal species (6 per type)";
  gyms.js "18 gyms"; tower "refuses until 18 badges (old champions keep access); levelBonus after 16";
  blocks.js "wool is 20–38"; a Key idea: **"The first 16 gyms come from `gymSpots(ORIGINAL_GYMS)`; gyms
  17+ from `extraGymSpots()` (furthest dry spots); never change either or call gymSpots with another
  count; caves are filled within 18 of the extra gyms before plants."** Open items: mention T4b.
- ROADMAP: left to the orchestrator (T4 → T4a done / T4b next).

## 6. Tests
Builder A:
- `roster` — no change needed (it derives types; expects 6 per type, ≥3 shapes). Must pass with 114.
- `weather` — add rows `['sandstorm','desert',false,'bone']` (need ×1.3) and `['stars','peak',true,'alien']`
  (need ×1.2); existing rows must still pass.
- New `tests/specs/bone-alien.mjs`: 6 creatures each, all spawn or evolve from a spawner, ≥4 moves per
  type, every creature knows a move of its type at Lv 20, the chart values above (spot checks:
  bone→ghost 2, electric→bone 0.5, alien→normal 2, sound→alien 2, toxic→bone 0.5), shapes per type = 3
  and none shared with older types, models build/animate, `moveInfo('bonetoss').text` has "hits 2 to 4
  times"; screenshot **`new-creatures.png`**: a 4×3 grid of `portrait(id, 220, 190)` for the 12 (draw
  the data URLs onto a canvas in the page and save it), plus each as `creature-<id>.png`.
Builder B:
- `gym` — `world.gyms.length === 18`; new part: with `[tidalord 45, thunderwolf 45]` beat the Fossil Gym
  trainer + leader and the Saucer Gym trainer + leader (`playBattle`), badges `bone` and `alien` awarded.
  **Needs A's species: run after A is merged** (until then B checks placement only).
- `new-types` — "HUD shows 18 badge slots".
- `champion` — `w.gyms === 18`; compare `pos.slice(0, 16)` with `GYM_POSITIONS`; refusals use
  `GYMS.slice(0, 17)` and expect '18 badges'; gap ≥ 23 still holds for all 18.
- `map` — "all 18 gyms fit"; `caves` — unchanged rules must still pass (gyms list now 18).
- New `tests/specs/old-saves.mjs` (platform trick not needed; uses `World` directly + saved games):
  1. Seeds 1 and 4242: first 16 gym positions = the fixtures, extra gyms = the spots above, FNV
     checksum outside the boxes = the values above, extra gyms ≥ 30 from all gyms and the tower,
     ≥ 40 from the middle, each has a wool roof of its type (`WOOL.bone` = 37, `WOOL.alien` = 38).
  2. Old champion save (seed 4242, 16 old badge ids, `beaten` with both guards, `champion: true`, no
     `size` change needed: `size: [224,224]`): after Continue, badges are the same 16, HUD has 18 icons
     with 16 lit, the Champion title shows, the guide arrow aims at the Fossil Gym, the "New gyms" toast
     appeared, `levelBonus === 10`, Coach Dex battles.
  3. Old 16-badge non-champion save: guard refuses with "18 badges"; after setting all 18 badges the guard
     battles. 4. Screenshots **`gym-bone.png`, `gym-alien.png`**: stone platform 22 blocks out from each
     door (see `champion` tower shot), looking at the building.
Orchestrator after merging A then B: full suite, alone on the machine; review the 12 portraits and both
gym shots.

## 7. Two builders (clean split)
**Builder A — creatures** (`species.js`, `shapes.js`, `weather.js`, `tests/specs/bone-alien.mjs`,
`tests/specs/weather.mjs`, README Features/Types/Moves). **Builder B — gyms & world** (`gyms.js`,
`world.js`, `caves.js`, `blocks.js`, `main.js`, `ui.js`, `creatures.js` comment, `style.css`,
`duel.js`, specs `gym`, `new-types`, `champion`, `map`, `old-saves`, README gym list + tower,
`CLAUDE.md`). No file is shared except README (different sections: small merge).
**Contract** (both can rely on these exact ids):
- types `bone`, `alien`; species `skullop→skullossal(22)`, `rattlepup→howlbone(22)`,
  `dinobit→stompasaur(24)`, `saucerling→ufomax(22)`, `blipling→blipstar(22)`, `podlet→tallipod(24)`;
  moves `bonebonk bonetoss fossilcrush dinostomp rattledance beepbeam tractorbeam ufoblast gravityflip mothership`.
- B: `WOOL.bone`/`WOOL.alien` and `ORIGINAL_GYMS` (exported from `gyms.js`). A must not touch gyms/world.
- Before A is merged, B's game still loads (gym teams are only read in battle; a missing
  `TYPE_COLORS.bone` only blanks a badge colour). Merge A first, then B; B's new gym battles run then.
Keep each edit to `main.js` in small separate blocks (T7 is next and touches `battle.js` only).

## 8. Decisions for the owner (defaults in bold)
1. Players who were already Champion: **keep the title and the tower (rematch, Coach Dex)**; the arrow
   leads them to the two new gyms. Alternative: lock the tower for them until 18 badges.
2. Wild creatures +10 levels: **after 16 badges, as now** (helps train for gyms 17–18). Alternative: after 18.
3. Map size: **stay 224×224** (room is measured; growing it would move every gym in old worlds).
4. New gyms go to the **furthest dry spots** (often far corners, any biome). Alternative: prefer desert
   for Bone and peaks for Alien (smaller gaps, more code).
5. New gym levels **28–30 (Fossil) and 29–31 (Saucer)**. Alternative: lower, if older players find
   them hard (the README already notes late gyms need training).
6. Type matchups as in section 1 (Bone > ghost, electric, alien; Alien > normal, metal, toxic).
7. Names: Skullop, Skullossal, Rattlepup, Howlbone, Dinobit, Stompasaur, Saucerling, Ufomax,
   Blipling, Blipstar, Podlet, Tallipod; Fossil Gym (Leader Digby), Saucer Gym (Leader Zeeb). **As listed.**
8. Gym buildings: **same building, new roof colour**. Alternative: bone pillars / a glass dome on top.
