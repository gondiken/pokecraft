# T48 (proposal, not built) · Jolly Jax's Surprise Party: a new Room of Doors

Owner, 2026-10-28: "Room of Doors is still so weird ... the emojis at the top of the doors are useless ... the piñata is half in the
wall of the slide room ... the slide looks like stairs ... there's no real 'surprise' element in the world, it's just a few doors we
break and a few games. I like catching the jack and smashing the piñata as small games but I don't like this world even as a concept.
I need you to come up with a better version."

## Owner's answer (2026-10-28) and the new frame

"The wheel, the twists, and the new games sound good. I just don't like that it's a TV show. My son has never seen the wheel of
fortune and doesn't know the concept of crowd cheering on a game show."

So the same games, wheel and twists, in a place every child knows: **a surprise birthday party.**

- **The place:** a giant party room inside an enormous present: bunting and balloons, a long party table, a huge birthday cake
  on a stand at the far end, presents piled everywhere, creature guests in party hats dancing and clapping (not an audience: guests).
- **The Party Spinner** (the wheel): a big spinning party plate on the wall with a picture of each game on its slices (a piñata, a
  jack, a stack of presents, a pop-up box). Press Spin! and press again to stop it: it stops at the slice under the arrow. A game you
  already won gives party sweets (cubes) and you spin again.
- **Party surprises** (the twists): before a round a party popper goes off and Jolly Jax calls out a surprise ("Surprise! Lights out!",
  "Surprise! Double gold!", "Surprise! The table spins!").
- **The party games:** Piñata Party, Jack Catch, Gift Stack, Pop-Up Whack (as below).
- **Party crashers** (the two helpers): Ribbon Rosa and Confetti Kit crash the party after the 1st and 3rd bow and want a battle.
- **The finale:** with four bows the candles on the cake light up, everybody shouts "SURPRISE!" and Jolly Jax bursts out of the cake
  for the star battle.

Wherever the text below says "show", "studio", "stage", "stands" or "host", read: party, party room, party floor, the guests, the
party's host.

## What went wrong

The world was a hall of doors with rooms behind them. Opening a door is not a skill, and most rooms were set dressing (a slide, a
ball pit, confetti) that a block world cannot make look like the real thing. The "surprise" was only *which room is behind which
door*, and you find that out once. The two games worked because they are games: something moves, you react.

## The idea: a TV game show

**Jolly Jax's Surprise Show.** The frame in the Swirl opens onto a bright TV studio: a round stage in the middle, a giant **Prize
Wheel** behind it, spotlights, a scoreboard, and stands full of cheering creatures. Jolly Jax (the giant jack-in-the-box) is the
host. You are the contestant.

- **The surprise is built into the show.** You never know what comes next: the wheel picks the next game, and the host throws a
  **twist** into each round ("Surprise! Lights out!", "Surprise! Double gold!", "Surprise! The stage spins!"). That is the
  randomness the owner said a Surprise world may have, and it is fair because every game is still a skill game.
- **Spin the wheel (timing).** Press Spin! as the wheel slows: it stops at the slice under the pointer, with a little wobble.
  Good timing picks a game you still need; a slice you have already won just gives a bonus (cubes) and you spin again.
- **The set changes in front of you.** The stage floor is made of panels that flip (setLive, no world edits) to build each game's set
  in a few seconds: the piñata rug rises out of the floor, the pop-up boxes pop out of the stage. No rooms, no doors, no walking
  around to find things.

## The four games (one bow each, keeping the saved bows)

1. **Piñata Party** (kept as it is: whack it when it swings at you, low).
2. **Jack Catch** (kept: run under the jacks, dodge the pies).
3. **Gift Stack (new, timing).** A crane swings a gift box back and forth over the stage; press Drop! to let it go. It lands on the
   tower and any part hanging over the edge is sliced off, so the next box is smaller. Stack 8 high to win. Perfect drops make a
   "ding!" and keep the box full size. A twist: the crane speeds up, or the boxes wobble.
4. **Pop-Up Whack (new, reflexes and aim).** Nine pop-up boxes on the stage; jacks pop out for a moment, one or two at a time. Whack them with
   the party stick before they hide (the stick and Whack! of the piñata, so one button). Gold jacks count double. **Pie jacks**
   (with a cream pie) must NOT be whacked: they splat you. A twist: lights out (only the jacks' noses glow), or a mirror stage.

None of these is like another world: Gift Stack is a release-timing stacker (the rope and Kick! are aim and power, not stacking), and Pop-Up
Whack is a whack-a-jack with a "don't hit that one" rule. Every game has three rounds that get harder, never a fail
(a miss just starts the round again, slower after two misses: the Funfair's kind help).

## Battles and the Boss

- **Commercial breaks:** after the 1st and 3rd bow the show "goes to a break" and a stagehand challenges you (Ribbon Rosa, then
  Confetti Kit, the two helpers of today; their saved wins count).
- **The finale:** with four bows the stage clears, the wheel turns gold, and Jolly Jax jumps out of his box for the star battle.
- A rematch: the bows are used up as today, the games are a bit harder (`hard`).

## What happens to saves

- The bows `pw:doors:bow1..4` and the helpers' keys stay: a bow already won counts as that game won. Nothing a player has is lost.
- The gift chest keys `pw:doors:gift1..4` keep their cubes (they were a one-time reward); there are no chests any more.
- The Room of Doors realm gets a new version (its terrain is new); its blocks were all fixed, so no player builds are lost.
- The Surprise creatures stay (the wrapped gift boxes), now walking the studio floor and the stands.

## What goes away

The hall, the twelve doors, the door signs, the slide, the ball pit, the springs, the nested doors, the shop, the Piñata Hunt and the
Big Gift chamber. (The Piñata Hunt was only added yesterday to give those rooms a point; the show does not need it.)

## Size

About the size of one wave 15 world: the studio terrain, the wheel, the flipping stage, two new games (Gift Stack and Pop-Up Whack, as
pure rules with tests like `pinata.js` / `jackcatch.js`), the twists, the show flow, and a rewritten `surprise` spec. One long session.

## Another idea, if the show does not feel right

**Popjack Town:** a toy town where every house is a jack-in-the-box and every gift box on the street might be a creature. Jolly Jax
has hidden the town's four bows inside boxes that hop away when you come near (the whole town plays hide and seek with you, at
random). It is more of an exploring world, with less clear skill in it, so I would choose the show.

## Decisions for the owner (my defaults in brackets)

1. Build the Surprise Show? (Yes.)
2. Keep the Piñata Party and Jack Catch as two of the four games? (Yes: you liked them.)
3. The two new games: Gift Stack and Pop-Up Whack, or swap one for something you would rather see? (Those two.)
