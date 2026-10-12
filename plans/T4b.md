# T4b · A 7th creature for every type (plan)

Owner's words (ROADMAP T4): one new creature for each type, each with its **own body shape** in
`src/shapes.js` (no recolours), an original name, a short child-friendly description, stats, a learnset
and a place to live. Shiny creatures are cancelled. **Planned as if T4a is merged** (19 types: the 17
old ones + `bone`, `alien`; 114 normal species; moves/T1–T4/UTIL for bone and alien as in `plans/T4a.md`).

Result: **133 normal species (7 × 19)** + Zenithar, 19 new body shapes (54 shapes in all), no new moves
(87 stays), no new evolutions (README "52 evolve" stays). All 19 are **single-stage, "sometimes"/rare**
finds, so the familiar creatures stay the common ones.

## 1. The 19 creatures (data)
All go in `SPECIES` (sections in §4). `model.extras` is `[]` unless noted. Flags: `flies`/`floats`
make them airborne (`creatures.js groundY`), `swims` + `waterOnly` keeps a creature in water (like Shimmerfin).
Stats sit with each type's other single-stage creatures (Magmole 237, Shellby 205, Voltwing 245, Quartzle
275 total); baseXp ≤ 100 except the rare drake/rainbow ones (baseXp > 100 gives wild ones +3 levels).

| id | Name | type | hp/atk/def/spd | baseXp, catch | learn | flags |
| --- | --- | --- | --- | --- | --- | --- |
| stitchums | Stitchums | normal | 70/60/60/50 | 85, 0.4 | `L('normal','pixie')` | |
| waxwobble | Waxwobble | fire | 50/75/50/65 | 90, 0.35 | `L('fire','ghost')` | |
| jellume | Jellume | water | 60/55/65/60 | 90, 0.35 | `L('water','electric')` | `swims, waterOnly` |
| bonzoise | Bonzoise | grass | 75/60/85/25 | 95, 0.35 | `L('grass','water',[[15,'hunker']])` | |
| wattwink | Wattwink | electric | 45/60/45/95 | 95, 0.35 | `L('electric','bug')` | `flies` |
| amethump | Amethump | rock | 55/70/100/25 | 100, 0.3 | `L('rock','mind')` | |
| flurrydome | Flurrydome | ice | 65/60/80/40 | 95, 0.35 | `L('ice','rainbow',[[30,'lullaby']])` | |
| twirlshell | Twirlshell | bug | 55/55/95/25 | 85, 0.4 | `L('bug','toxic',[[15,'hunker']])` | |
| lanterboo | Lanterboo | ghost | 50/65/50/75 | 95, 0.3 | `L('ghost','fire')` | `floats` |
| origrane | Origrane | mind | 50/70/50/85 | 100, 0.3 | `L('mind','grass')` | `flies` |
| tickatin | Tickatin | metal | 55/70/85/45 | 100, 0.3 | `L('metal','electric')` | |
| gurglepot | Gurglepot | toxic | 70/70/65/35 | 95, 0.35 | `L('toxic','grass')` | |
| cuppix | Cuppix | pixie | 55/55/60/70 | 95, 0.35 | `L('pixie','fire')` | `floats` |
| nimbrake | Nimbrake | drake | 60/80/60/75 | 110, 0.2 | `L('drake','electric')` | `flies` |
| chromacurl | Chromacurl | rainbow | 55/70/60/85 | 110, 0.2 | `L('rainbow','bug')` | |
| voidle | Voidle | cosmic | 50/65/60/70 | 100, 0.3 | `L('cosmic','ghost')` | `floats` |
| clawdio | Clawdio | sound | 60/70/80/45 | 100, 0.3 | `L('sound','water')` | |
| finnibone | Finnibone | bone | 50/70/55/75 | 95, 0.35 | `L('bone','water')` | `floats` |
| zorbit | Zorbit | alien | 50/60/70/80 | 100, 0.3 | `L('alien','cosmic')` | |

Learnset notes: `second` must have `T1`/`T3` entries, so never `'normal'` (it has none). Every one knows a
move of its own type at Lv 20 (checked). The three `extra`s reuse existing, non-signature moves (Bonzoise and
Twirlshell hide in their shell; the snow globe plays a music-box tune). **No new moves**: T7 (attack
animations) works from the final move list next, and nothing here needs one.

Descriptions (`desc`, for the Book):
- Stitchums: "A patchwork teddy that came to life. Every patch is a hug it got from a friend."
- Waxwobble: "A little candle that waddles around at night. Its flame flickers when it giggles."
- Jellume: "A glowing jellyfish that bobs along the waves. Its tickly tentacles give tiny zaps."
- Bonzoise: "A slow tortoise with a tiny tree growing in its flowerpot shell. It trims the leaves itself."
- Wattwink: "A firefly whose tail is a light bulb. It blinks to say hello on warm nights."
- Amethump: "It looks like a plain round rock, until it opens up to show the purple crystals inside."
- Flurrydome: "A snow globe that hops about. Shake it gently and it fills with dancing snow."
- Twirlshell: "A snail with a swirly shell. It is never in a hurry and leaves a shiny trail."
- Lanterboo: "A friendly paper lantern with a little ghost inside. It lights the way for lost travellers."
- Origrane: "A paper bird folded by a wish. It thinks so hard that its forehead glows."
- Tickatin: "A tin wind-up mouse. When its key stops turning, it sits down for a little nap."
- Gurglepot: "A jug-shaped plant full of bubbly goo. It burps loudly, then says sorry."
- Cuppix: "A teacup with fairy wings. It sloshes warm tea at anyone who is mean."
- Nimbrake: "A drake made of fluffy clouds. When it sneezes, tiny lightning bolts come out."
- Chromacurl: "A curly-tailed lizard whose colours slowly change. It is very hard to spot!"
- Voidle: "A soft little black hole. It pulls in socks and crumbs, but always gives them back."
- Clawdio: "A crab with a jukebox shell. It snaps its claws to the beat of its own songs."
- Finnibone: "A fish skeleton that swims through sand as if it were water. It loves a splashy race."
- Zorbit: "A space hamster rolling around in a glass ball. It came to Earth to find the best snacks."

**Names** checked: none is a known monster-game name, none matches an existing or T4a species, none
starts with a famous one's syllable (e.g. "Lit-wick", "Geo-dude", "Lamp-ent", "Swirl-ix", "Haunt-er" were
avoided on purpose). The spec checks no duplicates with the rest of `SPECIES`.

## 2. Where they live (spawns)
Rules kept (`blocks` spec + README promises): ice only in snow/taiga/peak; cosmic only at night; ghosts only
at night (caves count as dark); rainbow only by day; Jellume only in the `water` table (`waterOnly`).

| group | entries (`[id, weight, when?]`) |
| --- | --- |
| A | plains `['stitchums',1.2]` · meadow `['stitchums',0.8,'day']` · cave `['waxwobble',1]` · desert `['waxwobble',0.6,'night']` · water `['jellume',1.2]` · forest `['bonzoise',1]` · swamp `['bonzoise',0.8]` · plains `['wattwink',0.8,'night']` · meadow `['wattwink',1,'night']` · swamp `['wattwink',0.6,'night']` · cave `['amethump',1.5]` · mountain `['amethump',1]` · snow `['flurrydome',1]` · taiga `['flurrydome',0.8]` · peak `['flurrydome',0.4]` |
| B | forest `['twirlshell',1]` · swamp `['twirlshell',1]` · forest `['lanterboo',0.8,'night']` · swamp `['lanterboo',1,'night']` · cave `['lanterboo',0.6]` · plains `['origrane',0.6,'day']` · meadow `['origrane',0.8,'day']` · mountain `['origrane',0.4]` · mountain `['tickatin',1]` · cave `['tickatin',0.6]` · beach `['tickatin',0.4]` · swamp `['gurglepot',1.2]` · forest `['gurglepot',0.6]` · meadow `['cuppix',1,'day']` |
| C | mountain `['nimbrake',0.3]` · peak `['nimbrake',0.3]` · forest `['chromacurl',0.25,'day']` · meadow `['chromacurl',0.2,'day']` · mountain `['voidle',0.5,'night']` · snow `['voidle',0.4,'night']` · peak `['voidle',0.3,'night']` · desert `['voidle',0.4,'night']` · beach `['clawdio',1.2]` · cave `['clawdio',0.3]` · desert `['finnibone',1.2]` · beach `['finnibone',0.6]` · cave `['finnibone',0.6]` · plains `['zorbit',0.6,'night']` · desert `['zorbit',0.6]` |

Measured (node script on a copy of `src/` with T4a's planned spawns added, then these):
- New creatures' share of each table: 4–15% (water 10.8% Jellume, swamp ~14%, cave ~13%, everywhere
  else 4–10%); no single new one above 7% anywhere.
- Weather spec ratios (need → T4a only → with T4b): storm/plains/electric 2 → ×2.55 → ×2.60; rain/swamp/water
  1.8 → ×1.93 → ×2.01; snow/peak/ice 1.5 → ×2.03 → ×1.98; rainbow/meadow 5 → ×8.2 → ×7.9 (boosted 23%);
  sandstorm/desert/rock 1.5 → ×1.66 → ×1.68; fog/swamp/ghost 1.5 → ×1.84 → ×1.83; stars/peak/cosmic
  1.3 → ×1.40 → ×1.41. All still pass.
- **Heads-up for T4a (not T4b's job):** with T4a's planned boosts its two new weather rows come out at
  sandstorm/desert/**bone ×1.00** (bone 1.5 = fire 1.5 < rock 2.5, so the share can't rise) and
  stars/peak/**alien ×1.05**, not the ×1.3 / ×1.2 the T4a plan asks for. T4a's builder must change those
  boosts or the expected numbers; T4b adds no bone/alien weight to desert-day or peak-night that changes this
  by more than 0.01.

## 3. Models: 19 new builders in `shapes.js`
Conventions (as now): face +Z, stand on y = 0, sizes for scale 1 about 1 block tall, helpers `box pivot eyes
glow zigzag addWings gem ball` and the module-local `swing spin mouth has`. Animation only through the
existing hooks, so **`animateModel` is not changed**: `parts.bounce` (+ `parts.hover` = floating bob),
`legs`, `arms`, `tail`, `head`, `wings`, `flap`, `segments` (`{g, i}`, pivots at x = 0), `wobble` (via `swing`),
`spin`, `tip` (one glowing mesh that pulses), `rainbow` (`[{mat, offset}]`, colour cycling). Transparent
glass: `mesh.material.transparent = true; opacity 0.25–0.6; depthWrite = false`. Never set `parts.float`
(that makes the whole model see-through). Each shape name below is **new** (not one of quad, blob, biped, bird,
serpent, bug, guardian, butterfly, moth, star, robe, hopper, planet, comet, cloud, tall, squid, bat, drum,
ape, bell, armadillo, wyvern, fish, nut, drone, wisp, puff, crystal, skull, bonedog, dino, ufo, visitor, tripod).

Recipe format: `shape · scale · body / accent / dark / belly`.

**Group A**
- `plushie` (Stitchums) · 0.85 · 0xc89a6a tan / 0x7ac0e8 blue patch / 0x5a3a2a stitches / 0xf2c4d4 pink patch.
  Teddy: torso 0.5×0.5×0.4 at y 0.45, big head 0.6×0.5×0.5 on `parts.head`; one upright round ear and one
  **floppy ear** on a pivot (`swing` z 0.3, speed 2); **button eyes** (dark 0.12 squares, 4 tiny light dots,
  `userData.eye`); stitched V smile (3 dark bits); a pink tummy patch and a blue patch on the head and one leg,
  each edged with dark stitch dashes; a seam strip down the head; a white cloth tag on the hip; stubby
  `arms` and `legs`.
- `candle` (Waxwobble) · 0.8 · 0xfff0d8 wax / 0xffb030 flame / 0x8a5a2a wick / 0xffe6b8 drips. Body pivot =
  `parts.bounce` (waddle). Brass holder dish 0.8×0.08×0.8 (0xd0a040) with a ring handle on one side; candle =
  two 0.44×0.7×0.44 boxes, one turned 45° (octagon); melted lip on top; 5 drips of different lengths down the
  sides; face with rosy cheeks; wick; **flame pivot**: outer glowing box 0.16×0.24 (accent) = `parts.tip`
  (pulses) + inner core 0.08×0.14 (0xfff6c0, glow), `swing` z 0.2 speed 7 → flicker.
- `jelly` (Jellume) · 0.85 · 0x9ad8ff / 0xff8ad8 / 0x4a7ab0 / 0xd8f2ff. `parts.bounce` + `parts.hover` (bobs).
  Wide flat **dome** (0.9×0.3×0.9 at y 0.75, 0.66×0.18 above, 0.4×0.1 cap), see-through (opacity 0.6);
  4 glowing accent dots in a clover inside; frilly rim of 8 belly bits; face on the dome front; **6 ribbon
  tentacles** (pivots on a 0.3 circle under the rim, 3 thin shrinking segments each, glowing tips), each
  `swing` on x or z, amp 0.35, speed 2.5, phase k. Must not look like `squid` (a brain): flat umbrella, long thin ribbons.
- `bonsai` (Bonzoise) · 0.9 · 0x8ab86a skin / 0xff9ac0 blossoms / 0x5a3a20 trunk / 0xc8683a terracotta.
  Low tortoise: 4 stubby `legs` (quad phases), head on a short neck (`parts.head`), little tail. **Shell =
  flowerpot**: 0.8×0.35×0.9 terracotta box, a 0.9×0.08×1.0 rim, darker band, soil top (0x4a3020); a **bonsai
  tree** on it: 3-box zigzag trunk, 3 flat cloud-pruned leaf pads (0x4a9a3a, 0.4×0.12×0.35) at different
  heights, 4 pink blossoms; the tree group `swing`s z 0.06 speed 1.2 (sways).
- `bulbfly` (Wattwink) · 0.75 · 0x3a3a5a / 0xfff27a / 0x8a8a98 metal / 0xfff8d0 glass. `bounce` + `hover`.
  Small head (`ball` 0.18) with big eyes and two antennae with knobs; thorax box; a **screw base** (3 grey ring
  boxes) behind it; **light-bulb tail**: glass `ball` r 0.26 (opacity 0.55) with a glowing `zigzag` filament
  inside; a glowing core box in the bulb = `parts.tip` (it blinks). Two pairs of pale wings via `addWings`
  (lift 0.3); 6 tiny dark legs. (Glowbug is a fuzzy moth; this one must read as "bulb".)
- `geode` (Amethump) · 0.85 · 0x8a7a6a rock / 0xc080ff amethyst / 0x4a3a3a / 0x6a4a8a inner. Body pivot =
  `bounce` (thumps). Lower half 0.8×0.35×0.8 with lumps; **lid** (upper half 0.8×0.32×0.8) hinged at the back:
  outer pivot rotation.x = -0.3, inner pivot `swing` x 0.2 speed 1.5 → it opens and closes like a clam;
  inside both halves a ring of 6–8 glowing accent crystal spikes (thin, tilted); eyes + smile peeking from
  the gap; 2 stubby feet (`legs`). Must not look like `crystal` (a walking crystal cluster).
- `globe` (Flurrydome) · 0.85 · 0x6a4a3a wood / 0xffffff snow / 0x3a2a1a / 0xdff6ff glass. `bounce`.
  Wooden base 0.7×0.28×0.7 with a gold band (0xd8b040), the face on the base front (eyes, smile, cheeks),
  2 stub `legs`; **glass ball** (`ball` r 0.38 at y 0.75, opacity 0.3, depthWrite false); inside a snow mound,
  a tiny pine (2 green boxes + trunk); a **snowflake pivot** with 10 tiny white boxes (positions from k·2.4
  angles, r ≤ 0.3) → `spin` y 1.2 so the snow swirls.

**Group B**
- `snail` (Twirlshell) · 0.85 · 0xb8d86a / 0xffa040 shell / 0x6a4a2a / 0xe0f0a0 foot. Long low foot
  0.36×0.14×1.0 with a tapered tail; upright neck at the front; **two eye stalks** (thin 0.04×0.3, ball eyes
  with pupils on top, `userData.eye`), each `swing` x/z slowly in different phases; small smile; **spiral
  shell**: 12 boxes on a shrinking circle in the y-z plane (r 0.35 → 0.08), stripes alternating accent/dark,
  centred on the back at y 0.45; slow-glide look: front foot piece on a pivot `swing` x 0.08 speed 3 (ripple),
  shell `swing` z 0.05. No legs, no bounce (the default root bob is enough).
- `lantern` (Lanterboo) · 0.8 · 0xffe0a0 paper / 0xffa84a glow / 0x5a3a6a caps / 0xfff4d8. `bounce` + `hover`.
  Paper lantern barrel (0.5×0.12, 0.64×0.4, 0.5×0.12 stacked) with a soft glow (`glow`, emissiveIntensity
  ~0.35) so it lights up at night; 3 thin dark rib bands; dark top/bottom caps; a carry handle (3 boxes)
  on top; a ghost face painted on the paper (eyes + round "oo" mouth); inner flame box seen under the
  bottom = `parts.tip` (flickers); a **wispy ghost tail** (3 shrinking belly boxes) under it on a pivot
  `swing` z 0.3 speed 3; whole lantern `swing` z 0.12 speed 1.5 (sways as if carried). Must differ from
  `bell` and `wisp`.
- `crane` (Origrane) · 0.9 · 0xfff8f0 paper / 0xf06a9a mind glow / 0xd0c8c0 folds / 0xf6e8e0. `bounce` + `hover`.
  Folded body 0.3×0.25×0.7 with a ridge box turned 45° on z; long thin neck tilted forward-up; small pointed
  head bent down, tiny eyes (size 0.05), a glowing accent dot on the forehead (`gem`); tail spike angled up;
  **big flat triangle wings** (pivot, 0.7×0.03×0.4 + 0.4-long tip piece) with dark fold-line strips, in
  `parts.wings` (lift 0.2) so they flap slowly; no legs.
- `windup` (Tickatin) · 0.8 · 0x6ab0e0 tin / 0xe04a4a stripe / 0x5a6070 wheels / 0xd8dde4 silver. `bounce`.
  Tin mouse: dome body (0.5×0.3×0.7 + 0.4×0.15×0.55 top), a red stripe, 6 silver rivets, silver nose cone
  with a black nose, round flat silver ears, eyes; **4 wheels** (octagon from 2 boxes) each `spin` x 6;
  **wind-up key** on the back (stem + 2 flat loops) `spin` z 2.5; curly spring tail (5 small boxes in a
  spiral) `swing` y. No legs.
- `pitcher` (Gurglepot) · 0.9 · 0x7ac04a / 0xd04a7a veins+lid / 0x3a6a2a / 0xb06ad6 goo. `bounce`.
  Jug of stacked widening boxes (0.4 → 0.56) with an accent rim at y 0.88; red vein strips up the sides;
  glowing goo surface inside the rim + 2 small goo bubbles on a `swing`ing pivot; a **leaf lid** hinged at the
  back (accent 0.6×0.04×0.5, held open ~-0.5) that `swing`s x 0.25 speed 2 (burps); face with a wide smile;
  two long leaf `arms`; 3 root feet (2 in `legs`).
- `teacup` (Cuppix) · 0.75 · 0xfff6fa porcelain / 0xff8ac8 pattern / 0x8a5a3a tea / 0xffd8ec. `bounce` + `hover`.
  Saucer 0.9×0.06×0.9 with an accent rim; cup 0.5 → 0.6 wide, rim 0.66 at y 0.64; tea surface (dark) inside;
  accent heart/dot pattern on the sides; loop handle (3 boxes) on +x; face + blush on the front; **pixie
  wings** via `addWings(..., { upright: true })` on the back; 2 **steam** pivots of 3 small white
  see-through boxes rising, `swing` z.

**Group C**
- `nimbus` (Nimbrake) · 1.0 · 0xf4f8ff cloud / 0xffe060 lightning / 0x6a7aa0 storm / 0xc8d8f0. `bounce` + `hover`.
  Serpent drake made of **cloud puffs**: head on `parts.head` (0.36×0.3×0.4 with a snout, two small grey horns
  curving back, two long accent whiskers that `swing`, eyes); 6 body segments, each a `ball` puff plus 2
  offset small puffs, shrinking 0.3 → 0.16, along -z with a gentle up-down line, in `parts.segments` so the
  body waves; 2 pairs of tiny puff paws; tail tip = glowing `zigzag` bolt. No wings (unlike `wyvern`), and
  long/serpentine (unlike `cloud`).
- `chameleon` (Chromacurl) · 0.85 · 0x6ad06a / 0xffd84a / 0x2a6a3a / 0xd8f0a0. Body 0.36×0.4×0.7 at y 0.45 with
  a crest of 5 small spikes; head on `parts.head` with a raised casque; **turret eyes**: a `ball` (0.09) each
  side with a black pupil, each on a pivot `swing` y 0.5 at different speeds (1.3, 1.9) so they look around
  separately; smile; 4 grippy `legs`; **curled tail** on `parts.tail`: 8 boxes on a shrinking circle curling
  down and under. **Colour shift:** at the end of the builder collect every mesh that is not an eye/pupil into
  `parts.rainbow = [{ mat, offset }]` with offset 0.30 (body) or 0.36 (belly, crest): the existing
  `animateModel` loop then turns the **whole lizard** slowly through the colours together (other rainbow
  creatures shimmer block by block). Do **not** use the `'rainbow'` extra (buildModel would overwrite it).
- `blackhole` (Voidle) · 0.8 · 0x2a1a4a / 0xb08aff swirl / 0x120a20 / 0x4a2a7a. `bounce` + `hover`. Fluffy dark
  puff (`ball` 0.3 + 6 fuzz bits), big sparkly eyes (`eyes` size 0.16 + 2 white glints), small "o" mouth;
  **galaxy swirl** behind it: a pivot facing front with 3 spiral arms of 4 shrinking glowing accent boxes,
  `spin` z 1.5; 4 tiny white sparkles on a faster pivot (`spin` z 3) being "pulled in". Must differ from
  `planet` (ring on y) and `puff`.
- `jukebox` (Clawdio) · 0.85 · 0xd0603a / 0x4ae0d0 lights / 0x5a2a1a / 0xffd890 chrome · extras `['notes']`.
  Jukebox body 0.7×0.5×0.45 at y 0.45 with an arched top (0.56, 0.4 wide steps); 3 glowing arch stripes
  (accent, 0xff6ad8, 0xffe060); chrome speaker grille with dark slits; a **record** on top (dark octagon
  disc, accent label) `spin` y 3; eye stalks at the top corners (`swing`); 2 claw `arms`, each claw's upper
  pincer on a pivot `swing` x 0.3 speed 4 (snaps to the beat); 3 thin legs a side as side-legs
  (`{ g, phase, side: true }`, like `buildBug`) → scuttles sideways.
- `fishbone` (Finnibone) · 0.85 · 0xf2ead6 bone / 0x7fe0ff glow / 0x3a3040 / 0xe0d6bc. `bounce` + `hover`
  (it swims through the air just above the sand). Skull head (0.34×0.3×0.32) with big dark sockets and glowing
  accent pupils (`userData.eye`), a grin of white teeth; **spine** of 5 vertebra pivots along -z in
  `parts.segments` (wiggles), each with a pair of thin curved ribs that shrink toward the tail; 3 thin dorsal
  bones; a V tail of two bony rays. Clear gaps between bones so it never reads as the solid `fish`.
- `zorb` (Zorbit) · 0.8 · 0x9de07a / 0xc08cff / 0x3a6a2a / 0xd8f0ff glass. `bounce` (hops). **Glass ball**
  (`ball` r 0.42 at y 0.45, opacity 0.22, depthWrite false) with 2 crossing accent bands (8 boxes each round the
  x axis) on a pivot `spin` x 2 (it rolls); inside, not rolling: a fluffy round alien (`ball` 0.18) with
  **one big eye**, two antenna ears with glowing tips (`swing` z, opposite phases) and 2 tiny running `legs`.

Portrait check per builder: the portrait camera frames the bounding box, so keep thin long parts (whiskers,
tentacles, handles) within ~0.5 of the body or the creature looks tiny.

## 4. Code layout (no merge conflicts)
**Step 0 (orchestrator, one small commit on the merged T4a branch, before the builders start).**
1. `species.js` `SPECIES`: right before the `/* legendary: ... */` comment add three empty marked sections,
   separated by a blank line (so hunks never touch):
   ```js
     /* ==== T4b group A (normal fire water grass electric rock ice): builder A only ==== */
     /* ==== end of T4b group A ==== */

     /* ==== T4b group B (bug ghost mind metal toxic pixie): builder B only ==== */
     /* ==== end of T4b group B ==== */

     /* ==== T4b group C (drake rainbow cosmic sound bone alien): builder C only ==== */
     /* ==== end of T4b group C ==== */
   ```
2. `species.js` right after the closing `};` of `SPAWNS`:
   ```js
   // T4b: each type's 7th creature. Kept per group so three builders never edit the same lines.
   const SEVENTH_A = {
   };

   const SEVENTH_B = {
   };

   const SEVENTH_C = {
   };

   for (const extra of [SEVENTH_A, SEVENTH_B, SEVENTH_C]) for (const [biome, list] of Object.entries(extra)) SPAWNS[biome].push(...list);
   ```
3. `shapes.js` right before `export const SHAPES`: three sections, each `/* ==== T4b group X shapes ==== */`,
   `const SHAPES_X = {};`, `/* ==== end of T4b group X shapes ==== */` (X = A, B, C, blank line between), and
   add `...SHAPES_A, ...SHAPES_B, ...SHAPES_C,` as a **new last line** inside the `SHAPES` object.
4. Specs, docs and `duel.js` (§5, §6) are also done in step 0, with the final numbers.

**Builders** edit only between their own markers: species entries (Book numbers follow `SPECIES` order, so
the new ones become #115–#133, A then B then C), their `SEVENTH_X` object (`biome: [entries]`), and their
shape section (builder functions + `const SHAPES_X = { plushie, candle, ... }`). Rules:
- **Every new top-level name in `shapes.js` is either one of your shape names or ends in your group letter**
  (e.g. `glassA`): duplicate top-level function names from two branches are a SyntaxError in a module.
  No new top-level names in `species.js`. No new imports needed (`shapes.js` helpers are in scope; species
  data only uses `L`).
- Never touch `animateModel`, `buildModel`, other sections, `SPAWNS` itself, or the spec/README files.
- Builder C only: optional `CRIES.clawdio` in `sound.js` (a jaunty 4-note jukebox jingle + a "click"
  `noise`); the only edit in that file.

**Merge**: A, then B, then C into the integration branch (expected: no conflicts). Then the full suite.

## 5. Tests
Step 0 updates (they pass only after all three groups are merged; builders don't run them):
- `roster`: `r.count === r.types.length * 7` and message `7 per type`; the "at least 3 shapes" check stays.
- `new-types`: `i.mons.length === 7` (`cosmic`, `sound`).
- `book`: Fire filter `fire.n === 7` / "the 7 fire creatures".
- `bone-alien` (T4a's spec): 7 creatures per type; T4a's "shapes per type = 3 / not shared" check must look at
  T4a's 12 ids only (e.g. `FAMILIES = ['skullop', ...]`), not the whole type.

New **`tests/specs/seventh.mjs`** (step 0 writes it; each builder runs `T4B_GROUP=A node run.mjs seventh`):
```js
const GROUPS = { A: ['stitchums','waxwobble','jellume','bonzoise','wattwink','amethump','flurrydome'],
  B: ['twirlshell','lanterboo','origrane','tickatin','gurglepot','cuppix'],
  C: ['nimbrake','chromacurl','voidle','clawdio','finnibone','zorbit'] };
const OLD_SHAPES = [/* the 35 names listed in §3 */];
const ids = process.env.T4B_GROUP ? GROUPS[process.env.T4B_GROUP] : Object.values(GROUPS).flat();
```
In the page, for each id (all must exist in `SPECIES`):
1. one per type: the ids cover each type once (full run: all 19 types, `TYPE_COLORS` keys); no `evolve`,
   nothing evolves into it, not legendary;
2. `model.shape` is not in `OLD_SHAPES`, `SHAPES[shape]` is a function, and **exactly one species** uses it
   (also no two new ones share one);
3. name is unique across `SPECIES` (case-insensitive) and the `desc` is ≤ 110 characters;
4. spawns: in at least one `SPAWNS` table; ice ones only snow/taiga/peak; cosmic only `'night'`; ghost only
   `'night'` or cave; rainbow only `'day'`; `waterOnly` ones only in `water`; every weight ≤ 1.5;
5. moves: `makeCreature(id, 5).moves.length ≥ 2`; at Lv 20 knows a move of its own type; every learnset id is
   in `MOVES`;
6. model: builds; after `animateModel(m, 0)` the bounding box height is 0.35–2.6, width/depth ≤ 2.6, `min.y ≥
   -0.1` (nothing under the ground); **it has an idle animation**: a signature (sum over meshes of world
   matrix position + rotation elements + `material.color` + `emissive`) differs between `animateModel(m, 0.3,
   false)` and `(m, 1.1, false)`; `disposeModel` works;
7. Chromacurl (when in the group): a body mesh's hue at t = 0 and t = 2 differs by > 0.1;
8. a wild one can be made and battled: `makeCreature(id, 12)` has `hp > 0`;
9. **screenshots**: `portrait(id, 220, 190)` for each id drawn into one canvas in the page, 5 per row with the
   name under each (white background, 14px font), saved as `tests/screenshots/seventh-creatures.png`
   (group runs: `seventh-creatures-A.png` ...); also save
   `creature-<id>.png` for each;
10. no page errors.

Full run also: `weather`, `blocks`, `caves`, `book`, `roster`, `new-types`, `bone-alien`, `battle-and-menu`,
`pvp` (duel version). Builders run `seventh` (their group) + `blocks` + `weather` + `caves` (spawn tables).
Orchestrator: full suite alone on the machine, then **look at `seventh-creatures.png`** (each one reads as its
idea, faces visible, none looks like an older creature) and a few `creature-<id>.png`.

## 6. Docs and the rest (step 0)
- `duel.js` `VERSION` +1 (3 → 4 after T4a): a player on the old game can't build the new species.
- README Features: "**133 original creatures**, 7 for each of the 19 types"; add after it: "Every type also has
  one rare creature that never evolves, like Lanterboo the lantern ghost, Clawdio the jukebox crab or
  Chromacurl, a lizard that slowly changes colour." Evolution count and moves count unchanged. Sound line:
  "Clawdio plays a jukebox tune" if C adds the cry. Weather/Types/Gyms unchanged.
- CLAUDE.md: species.js row "133 normal species (7 per type; the `roster` test checks this)"; shapes.js row:
  add the 19 new shape names; Key idea: "Each type's 7th creature is single-stage with its own shape; `SPAWNS`
  gets them from `SEVENTH_A/B/C` right after the table." Open items: T4b done (orchestrator updates ROADMAP).

## 7. Builders (3 × Sonnet, parallel worktrees from the step-0 commit)
| builder | types | creatures (shape) |
| --- | --- | --- |
| A | normal fire water grass electric rock ice | stitchums (plushie), waxwobble (candle), jellume (jelly), bonzoise (bonsai), wattwink (bulbfly), amethump (geode), flurrydome (globe) |
| B | bug ghost mind metal toxic pixie | twirlshell (snail), lanterboo (lantern), origrane (crane), tickatin (windup), gurglepot (pitcher), cuppix (teacup) |
| C | drake rainbow cosmic sound bone alien | nimbrake (nimbus), chromacurl (chameleon), voidle (blackhole), clawdio (jukebox), finnibone (fishbone), zorbit (zorb) + optional cry |

Each builder: species entries from §1, spawns from §2 into its `SEVENTH_X`, builders from §3, run
`T4B_GROUP=X node run.mjs seventh blocks weather caves`, **look at its own `seventh-creatures-X.png`** and
fix anything that reads wrong (too small, face hidden, looks like an older creature), commit on its branch.
Done when: `seventh` (own group) passes, the other three specs pass, the portraits look right.

## 8. Decisions for the owner (defaults in bold)
1. **All 19 are single-stage rare-ish finds** (no new evolutions, no change to existing families).
   Alternative: give a few a baby or grown-up form later.
2. Names: **as in §1** (Stitchums, Waxwobble, Jellume, Bonzoise, Wattwink, Amethump, Flurrydome, Twirlshell,
   Lanterboo, Origrane, Tickatin, Gurglepot, Cuppix, Nimbrake, Chromacurl, Voidle, Clawdio, Finnibone, Zorbit).
3. Bone and Alien ideas: **Finnibone (a fish skeleton that swims through sand) and Zorbit (a space hamster in
   a rolling glass ball)**. Alternatives: a wishbone bird; a crop-circle mole with an antenna.
4. Some roadmap ideas (candle, lantern, teacup, colour-changing lizard, cloud dragon, pitcher plant) are
   common in other monster games as objects/animals. **Keep them**, with our own names and clearly different
   blocky looks (checked in the screenshot review).
5. **No new moves** (T7 animates the final move list next). Alternative: one signature move each later.
6. **Clawdio gets its own jukebox cry**; the other sound-type cries stay.
7. Rarity: **weights 0.2–1.5** (sometimes/rare in the Book); Nimbrake and Chromacurl are rare like other
   drake/rainbow creatures.
