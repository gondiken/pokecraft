# T48 · Jolly Jax's Surprise Party: the new Room of Doors (plan, not built yet)

Owner, 2026-10-28. On the Room of Doors: "Those emojis at the top of the doors are useless ... the piñata is half in the wall of the
slide room ... the slide looks like stairs ... there's no real 'surprise' element in the world, it's just a few doors we break and a few
games. I like catching the jack and smashing the piñata as small games but I don't like this world even as a concept. I need you to come
up with a better version." On the first idea (a TV game show): "The wheel, the twists, and the new games sound good. I just don't like
that it's a TV show. My son has never seen the wheel of fortune and doesn't know the concept of crowd cheering on a game show."
Then: "Ok birthday party sounds good."

**Build this in a fresh session** (the plan is written so that a session that never saw this conversation can do it).

## Why the old world failed (do not repeat it)

- Opening a door is not a skill, and most rooms were scenery (a slide, a ball pit, springs, confetti) that a block world cannot make look
  like the real thing. A slide made of blocks looks like stairs.
- The only "surprise" was which room is behind which door, and you learn that once.
- The two games (Piñata Party, Jack Catch) worked because something moves and you react. Keep them exactly as they are.
- Signs with emoji over doors told the child nothing. No emoji signs.

## The idea

A **surprise birthday party** inside an enormous present. Everything a child knows from a real party: balloons, bunting, a long party
table with cups and plates, presents piled up, party hats, a huge birthday cake, party games, and the big "SURPRISE!" at the end.

- **The party room:** one big room (no doors, no side rooms), about 48 x 40 inside, walls of gift paper (`GIFT_WALL`), a ribbon band
  round the top, the open "lid" above (sky), bunting strings and balloon bunches (meshes, not blocks), a long table on one side, piles of
  presents in the corners, the **cake** (a big three-tier block cake with candles) on a low stand at the far end, the **party floor** in
  the middle where the games happen, the frame home by the entrance.
- **The guests:** the wild Surprise creatures (wrapped gift boxes, as today) walk round the edges and the table, and a few people guests
  in party hats (`look: 'party'`) stand about and clap and cheer when you win a round (a short arm-wave animation + a "Yay!" toast).
  They are guests at the party, not an audience.
- **The Party Spinner** (the wheel): a big round party plate on the wall behind the party floor, four slices with a **picture** of each
  game drawn on its canvas texture (a piñata, a jack-in-the-box, a stack of presents, a pop-up box; pictures, not emoji), an arrow at the
  top. On the spinner's pad the big button says **Spin!**; press it, it spins fast, press again (**Stop!**) and it slows over about 1 s
  and stops on the slice under the arrow (closed form from the press time; a small wobble from the seed). A slice you already won this
  round of bows gives party sweets (+2 cubes, once per spin) and you spin again; so good timing saves time, bad timing never blocks.
- **Party surprises** (the twists): before each round of a game a party popper goes off (confetti, a pop sound) and Jolly Jax's voice
  line pops up: "Surprise! ..." and one twist from that game's list is drawn from the seed. Twists change the game in a way you can see
  at once, never in a way that makes it unfair, and the first round of a game never has a twist.
- **Party crashers** (the two helpers, Ribbon Rosa and Confetti Kit, already in `pictureboss.js` as Jolly Jax's crew): after the 1st bow
  Rosa crashes the party ("Surprise! A party crasher!") and stands on the party floor wanting a battle; after the 3rd bow Kit does. Their
  saved crew keys stay as they are; a helper already beaten does not come back.
- **The finale:** with four bows the cake's candles light (setLive glow blocks), the guests gather, everybody shouts "SURPRISE!",
  confetti, and Jolly Jax (the giant Jestergrin model) **bursts out of the top of the cake** and stands on it for the star battle. Losing
  keeps you at the party (a rest spot by the table), as the base does.

## The four party games (one golden bow each)

Each game is played on the party floor; the floor's panels flip (setLive cells, never world edits) to build the game's set in about 2 s
(a "whoosh" and confetti), and back when it ends. Every game has three rounds that get harder; a miss simply starts the round again, and
after two misses it gets the Funfair's kind help (`fairHelp` in fairgames.js: slower, a bit more time). None can be failed.

1. **Piñata Party** (keep `pinata.js` and the live code as they are: the rug, Whack!, CRACKs when it swings at you low, three piñatas).
   It is one game with one bow now: its three rounds are the three piñatas (round 1 llama, 2 star, 3 rocket). Twists: "Surprise! Two piñatas!" (round 3 only, a
   second slower piñata), "Surprise! Wobbly rope!" (more swing), "Surprise! Lights out!" (the room dims, the piñata glows).
2. **Jack Catch** (keep `jackcatch.js`: run under the jacks, gold x2, dodge the cream pies). Three rounds of rising need (e.g. 6 / 9 / 12
   points; today's one round of 12 becomes round 3). Twists: "Surprise! Double gold!", "Surprise! Pie party!" (more pies, more
   warning), "Surprise! Sticky floor!" (a bit slower for everybody).
3. **Gift Stack** (new, `giftstack.js`, pure): a toy crane (a mesh) swings a present back and forth over a small table on the party
   floor; press **Drop!** to let it go. It falls straight down and lands on the stack; the part that hangs over the box below is cut off
   (and tumbles to the floor as a mesh), so the next present is that much smaller. A drop within a small tolerance is **Perfect!** (a
   ding, the present keeps its size, the stack glows). Win a round by stacking N presents (5 / 7 / 9) before the present is too thin (a
   miss = the stack topples, the round starts again). The crane speeds up each round. Closed form: the crane's position is a function of
   the round clock; the result of a drop is pure maths on the overlap, so 60 and 20 fps are the same. Twists: "Surprise! Wobbly crane!"
   (it swings in a figure of eight), "Surprise! Tiny presents!" (they start smaller), "Surprise! Windy!" (the swing drifts).
4. **Pop-Up Whack** (new, `popupwhack.js`, pure): nine pop-up boxes in a 3 x 3 on the party floor (the old `POP_BOX` / `POP_BOX_OPEN`
   blocks, lids via setLive); jacks pop up for a short moment, one or two at a time, from a seeded schedule. **Whack!** (the party stick
   and the Whack! code of the piñata: one button, E, a click, a tap on the jack) a jack before it hides: 1 point, a gold jack 2. A **pie
   jack** holds a cream pie: do NOT whack it (a splat: cream on the screen, a point off). Rounds need 8 / 11 / 14 points in 30 s; jacks
   stay up shorter each round. Twists: "Surprise! Lights out!" (only the jacks' noses glow), "Surprise! Mirror!" (a jack sometimes pops
   from the box opposite the one that shook), "Surprise! Speedy!" (shorter pops, more of them).

Gift Stack and Pop-Up Whack must not copy another world's challenge: Gift Stack is release timing on a moving crane (the Pirate rope /
cannons are aim and range, the Ball Stadium is power), Pop-Up Whack is reflexes with a "do not hit that one" rule (the piñata is timing
on one target).

## Progress and saves (nothing a player has may be lost)

- The four bows stay `pw:doors:bow1..4`, saved at once. Map them to the games: bow1 Piñata Party, bow2 Jack Catch (bow4 today), bow3
  Gift Stack, bow4 Pop-Up Whack. **A player who already has bows keeps the same NUMBER of bows:** on load, an old save's bow keys are
  read as "bows won" and assigned to games in the order Piñata Party, Jack Catch, Gift Stack, Pop-Up Whack (old bow4 = Jack Catch won
  stays Jack Catch). Write the mapping in one pure function with a test.
- The Spinner only lands "for real" on games you have not won; with all four won, the cake opens.
- Crew keys `pw:doors:crew1/2` stay. Gift chest keys `pw:doors:gift1..4` stay in saves but nothing reads them any more (their cubes were
  given). A won Boss battle uses the four bows up, as today, so a rematch is a new party, a bit harder (`hard`).
- `REALMS.doors`: new terrain, so bump its `version` (its blocks were all `fixed`, so no player build is lost; `cleanRealmEdits` drops
  old Room of Doors edits). Keep the realm id `doors`, the Picture World id `doors` (its star and frame), the Boss id `doors`. Rename the
  display name to **Surprise Party** (frame title, travel text "Unwrapping...", clock '🎁 Surprise Party', `enterText` "SURPRISE! Welcome
  to the party!", `arriveHint` "Spin the Party Spinner to start a party game!"). Redraw the frame's picture (`pictureworlds.js`): a
  cake, balloons and a present.
- Check `comingsoon.js`: the `doors` world stays behind `?preview` until the owner opens it (`OPEN_NOW`).

## What goes away

`doorsland.js`'s hall, the twelve doors, door layout shuffle, door signs, the slide, ball pit, springs, nested doors, the shop, the gift
chests, the Piñata Hunt (`pinatahunt.js`, added on 2026-10-28 only to give those rooms a point) and the Big Gift chamber. Delete the code
that is no longer used (keep `pinata.js` and `jackcatch.js`). The Surprise type, its creatures, moves and the wrapped-gift gait do not
change. Block ids: reuse the Room of Doors' own 235-243 (do not take new ids: only 254, 255 and the reserved 137-139, 182-183, 249 are
left in the whole game); `BALL_PIT` and `RIBBON` may get new looks or become cake / candle blocks if needed.

## Files (suggested)

- `src/partyland.js` (replaces doorsland.js; Node-runnable terrain as data: `PARTY` layout, the floor, the spinner wall, the table, the
  cake, rests, keeps, nooks for the wild gift boxes, the guest spots, `partyAim` for the guide).
- `src/spinner.js` (pure: the spinner's closed form, `spinStop(pressT, stopT, seed)` -> slice).
- `src/giftstack.js`, `src/popupwhack.js` (pure rules, no imports, like `pinata.js`).
- `src/partylive.js` (replaces doorslive.js; `LIVE.doors`: wires the spinner, the four games, twists, crashers, the cake finale, the
  score chip; `near` / `use` words Spin! / Stop! / Drop! / Whack! / Play!; `tap` for Whack on the iPad; `manual` + `step(dt)` and
  `info()` for tests).
- Models (crane, presents, cake top, balloons, bunting) in `src/partyprops.js`, instanced and with vertex colours like `fairprops.js`,
  and a `tests/party-preview.mjs` that photographs them.
- Rewrite the `surprise` spec: type data (unchanged), the party terrain for three seeds, the old-bow mapping, each game's pure rules
  with model players at 60 and 20 fps (a skilled player wins, a careless one does not), the spinner, the twists, the crashers, the cake
  finale, the Boss and a rematch, a reload, iPad (one big button: Spin! / Stop! / Drop! / Whack! / Play!), two browsers.
- README (the player-facing text), CLAUDE.md (code map rows and the key idea), `plans/T46.md` (one line pointing here).

## The owner's rules to keep in mind

Short, friendly words a child can read; iPad first (one big button, tap to whack); skill, not puzzles; a Surprise world may use plenty
of randomness, but fairly; never repeat another world's challenge; never erase progress; nothing saved but the keys.
