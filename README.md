# PokeCraft

A browser game that mixes a Minecraft-style voxel world with creature collecting.
Explore a procedurally generated block world, build and dig, battle and catch
wild creatures in Capture Cubes, and beat all 31 Gym Leaders to collect every badge.

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
| E | Battle the targeted creature, or talk to a person (on a Doormat with nothing targeted: your home); step through the Portal Door |
| H | Home screen, while you stand on a Doormat |
| P / Tab | Team & storage screen |
| R | Ride / get off (a creature with the "Can be ridden" badge; tablets: the Ride button) |
| C | Creature Book: every creature you've seen and caught |
| M | Champion missions (after you are the Champion) |
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

- **Voxel world**: a 288×368 terrain (the first 224×224 is the original land; newer land is to the east and south, and the newest strip is in the far south, waiting for new gyms) with a day/night cycle and 11 kinds of places (biomes): plains, flower meadows, forests, swamps, beaches, lakes, deserts with cacti, snowy pine forests with frozen lakes, mountains, snowfields and high peaks with glowing star crystals. Under the hills there are also **caves** (a 12th kind of place): look for a **stone arch with two lamps** on a hill, and walk down its stairs into big, lit caves with huge halls (crystal halls, glowing mushroom halls, underground lakes and a giant fossil with a ribcage), wide tunnels to explore, and lamp posts at the old small holes so you can spot them at night. Star crystals and glowing mushrooms light the way, and rock, metal, ghost and bone creatures live down there. Your lead creature glows to light your way underground, and **treasure chests** hide 3 Capture Cubes each.
- **29 building blocks**, including glass, fluffy cloud blocks, stone bricks, lamps (they glow and light up the ground around them at night), Glowcap mushrooms (they glow too), ice, sandstone, cactus and flower bushes. Press **B** (or tap the picked hotbar slot again) to choose which 9 are in your hotbar. Dig into rock to find coal and gold ore; gold you find in the ground sometimes hides a Capture Cube (gold you placed yourself doesn't).
- **Treasure blocks**: **Sunstone**, **Ruby** and **Sapphire** are rare gems hidden in the rock. Look for them glinting in **cave walls**, or dig deep under the hills. They are the only blocks you have to collect: each one you mine adds 1 to your count, each one you place uses 1. The hotbar and the Blocks panel show how many you have ("Ruby ×3"); at 0 they are greyed out. Your gems are saved with your game and stay yours when you visit a friend's world.
- **Squad creatures** are little crews standing on each other's shoulders (hat kids, sock puppets, bucket buddies and a coat with three kids in it). Every hit knocks one off the top, and the fewer are left, the weaker it hits. Moves that hit many times knock off more of them. The **Big Top Gym** (south of the start, a striped circus tent) has an acrobats' pyramid inside: climb it one battle at a time.
- **Riding**: some big creatures can be ridden (about 1 in 4 of them): look for the "Can be ridden" badge on your team screen, then press R or tap Ride. Land creatures run fast and jump high, water creatures swim on top of the water, sky creatures fly low (Space up, Shift down). Gyms are for walking, so you can't ride into them.
- **Hide and seek** (play together): pause, then Play together, then "Hide and seek with ..." (stand close to your friend). One of you hides while the other has a dark screen and waits 60 seconds. Then the seeker follows the hot/cold compass (Cold, Warm, Hot!, Very hot!) and taps or clicks the hider, or bumps into them, to find them. A Camo creature next to the hider fools the compass! You swap every round and the score is shown. No battles or riding during the game, and you stay inside the play area and out of the gyms.
- **231 original creatures**, 7 for each of the 33 types (see below). **Food** creatures are funny dishes with faces: sushi rolls on the beach, burgers on the plains, spaghetti bowls in meadows and forests, and an ice cream cone in the snow. **Squad** creatures are little crews standing on each other's shoulders (kids in beanies, sock puppets, bucket buddies, three kids in one coat): every hit knocks one off the top, and a smaller crew hits softer. **Dream** creatures only live in the Dream realm and look held together by nothing (a head-stander, a toddler's drawing, a balloon-head, an umbrella that rains upward). Each lives where it fits: pixies in flower meadows, toxic creatures in swamps, fire and rock ones in the desert, ice ones only in snowy places, cosmic ones come out at night, most of all on the high peaks, and **Bone** creatures (skulls, skeleton dogs, fossil dinos) live only in caves. **Alien** creatures (flying saucers, three-eyed visitors, space pods) drop in at night. Ghosts also only come out at night. **Sky** creatures (kites, balloons, sky whales) float over the mountain tops, **Slime** creatures wobble around swamps and caves, **Light** creatures (sun foxes, lighthouses) love sunny meadows and beaches, and **Paper** creatures (paper planes, origami frogs, storybooks) wander plains and forests. Three types have their own special way to be found: **Time** creatures (hourglasses, metronomes, alarm clocks) only come out for a minute at sunrise and sunset, when the sky turns orange and you hear a soft tick-tock. **Camo** creatures look exactly like a block (leaves, sand, stone or snow) and never move: watch for a blink, then hit or tap the block. **Cyber** creatures (pixel blobs, mouse pointers, Wi-Fi butterflies) only appear when two friends play together close by. **Cozy** creatures (blanket bunnies, mitten kittens, pillow sheep) and **Treasure** creatures (rolling coins, crystal foxes, gem rings, which sparkle all the time) only visit a home you build for them (see **Homes**).
- **Parkour creatures** (a lemur on a rope, a leaping ferret, pole-vaulters and a stick runner) sit up high: on treetops, roofs and pillars you build. Come close and they hop away; chase them a few hops until they are out of breath, then walk into them to battle.
- **Ninja creatures** (a masked raccoon that tiptoes, a little crow peeking over its wing, a squirrel that flicks leaves like throwing stars and a bamboo shoot hiding among the grass) sneak about in forests and tall grass, mostly in the evening and at night. Run at one and it vanishes in a puff of smoke and pops up a few blocks away! **Walk up slowly** (no running) and you can reach it and battle. After three puffs it is out of breath, so even fast runners catch it.
- **Homes**: put a **Doormat** in the floor (Blocks panel), stand on it. A home needs a floor from 8x8 up to 20x20, closed walls at least 3 high with **one door, 1 or 2 wide and 2 high**, and a full roof; the Doormat goes inside, by the door. **Cozy home**: half of the wall blocks are wood, plus 3 of Bed, Fireplace, a Rug (4 wool blocks on the floor), a Lamp and 2 Windows (glass); all 5 hearts means more visitors. **Treasure home**: 15 gems (Sunstone, Ruby, Sapphire) in the walls, floor or ceiling; the more gems, the more often treasure creatures visit (up to 5 times as often with 45). There is nothing to pick: your home is every kind it can be, so gems in a wooden cabin make it cozy **and** treasure! The meter shows each kind you have started and the red gaps glow in the walls and roof; **What can my home be?** shows every kind, each with its own **Show me a house** that spins an example. Treasure homes sparkle. When it is ready, cozy or treasure creatures may come to visit (treasure ones rarely!). One home per player: a new Doormat moves your home (the old one turns into Planks). New blocks: **Doormat**, **Bed**, **Fireplace** (it flickers and lights the room) and eight wool colours for rugs.
- **Dreams**: at night, look at the **Bed** in your own **cozy home** and press **E** (or tap it): "Go to sleep and dream?" You wake up in the **Dream realm**, a big sky of floating islands over a soft cloud sea: lavender grass, candy trees, trees that hang upside down under the islands, and giant everyday things (a pencil, toy blocks, a rubber duck, a spoon). Everything is light and bouncy: **jumps are twice as high** (moon jumps!), and **Bounce Blocks** are springs between the islands: stand on one, press jump and fly up high, steer in the air and land on the next island. If you fall off, you land softly on the cloud sea; the arrow shows the way to the nearest bounce block. A little **moon** on the screen sets while the night goes on, and when it is gone it is morning and you wake up beside your bed. The **Upside-Down House** (the Dream gym) floats above one island. Only **Dream creatures** (Flipsy, Scribbit, Bobbloon, Drizzup and their friends) live there. Touch the glowing **Wake Stone** (the arrow points to it once you have the Wonder Badge) to wake up too; losing a battle wakes you up as well. What you build in the dream stays there for next time. Friends you play with don't come along: they get a message, and you can't see each other until you wake up.
- **The Portal Door and the Swirl** (Champions only): beside the tower door stands a big **Portal Door**. It is dark until you are the Champion; then it swirls. Press **E** (or tap or click it) and you step into the **Swirl**: a pastel sky of painted clouds with floating decks, **rivers that run upwards** (stand in one and it carries you up), spiral and round-and-round stairs, and ten **picture frames** hanging in the air, each covered with a cloth (their worlds are not open yet; four are secret worlds that still wait for a name). Far away stands the **Wizard's tower**, shut tight, behind a **star bridge** that is still empty: one golden stone will light up for each of 11 stars (ten from the framed Picture Worlds and one from the Portal House, which is in the Swirl itself). The Wizard gives the 12th star himself. The 12 stars show in the top-right corner. The arrow points to the Portal Door home (or to the nearest river if you fall into the clouds). Step into the Portal Door in the Swirl to go home. There are no wild creatures and no morning in the Swirl, and you can build on its decks. The Swirl has four moods: the bright **Sherbet Sky** where you arrive, the glowing **Moonmilk Mist** by the north frames, the warm **Sundrop Shore** by the south frames and the starry **Inkwell Deep** out by the Wizard's tower. Look out for tumbling frames, upside-down crayons, a painter's palette and a giant paintbrush!
- **Tiny creatures** (wave 14) live only in the **Giant House**, and only in small hiding places: **Antsy** and **Antlas** (an ant carrying a crumb, then a whole sugar cube), **Thimbit** and **Spoolmouse** (a mouse in a thimble, then on a rolling cotton spool with a sewing pin), **Dustbun** and **Fluffnado** (a dust bunny, then a whirl of fluff) and **Pipsqueak** (a seed that squeaks). They all have big shiny eyes and they never move: they sit in a tipped cup, under a leaf pile, in a flowerpot, a slipper or a crack in the wall and **peek out now and then**. Come closer and they stay out; walk into one to battle it. Tiny moves are strong against Racer, Food and Cyber, but fire, sky and ball are strong against them. Their big moves are Hide in a Cup, Ant Army and Small World.
- **The Giant House** (the first Picture World, the **house frame** in the Swirl, Champions only): you step into the picture and shrink to the size of the Wizard's pet mouse, so the kitchen is **huge**. Ways up to the table, where **Nibbles, the Wizard's Mouse** waits on a giant cookie with the first **star**: ride the **toy train** (press the big red button on its remote; press the other remote to call the train back), walk up the toy ramp, or find the other ways: turn on the **fan** and ride the wind up to the shelf, turn on the **tap** and float down the river on a **bottle cap**, climb down the **spoon**. On the way, **tiptoe past the sleeping cat** (run on its bench and it wakes up for a few seconds: just wait). Two **secret ways** are there for the curious: a **mouse hole** in the wall and a **keyhole** in a cupboard. Look for **12 cookie crumbs** (+1 Capture Cube each, +5 for all of them) and the Tiny creatures peeking out of cups, flowers and leaves. Nibbles has four creatures (levels 59-62) and gives rematches once you hold the star.
- **Obstacle Course** (gym 30, in the south): a tall obstacle course, climbing three laps up to the leader at the very top. Some blocks crumble after you step on them, blink blocks come and go (when yours flashes, jump to the next one), red zap tiles send you back when they light up, pushers push you off the beams, and springs throw you up high. There are only four checkpoint flags (the start, the two trainers' landings and the finish): fall and you go back to your furthest flag. Walk out of the course and the flags start over. Hold Shift (or push the stick all the way) to run and jump further. Once you have the badge, just jump down from the top to leave.
- **Shadow Dojo** (gym 32, in the south): a walled garden at dusk with paper lanterns, a dojo hall and a pagoda. Leader Kage waits on the pagoda roof with Master Suzu and Master Ren (beat both masters first). Night guards walk around with lanterns: stay out of the yellow light on the floor! The guards never battle; if one spots you, a puff of smoke takes you back to the last stone lantern you walked past (nothing is lost). Hide in tall grass, behind paper screens or between barrels. The golden boards squeak when you run on them and the watchers turn to look: walk softly (the green tatami mats are always quiet). The masters look out at the gate, and the pagoda stairs come up behind them: sneak up behind a master and talk to (or tap) them for a **surprise attack**: your creature moves first! (Sneak up on a guard and he just jumps.) Like jumping? Climb the barrels onto the garden wall and take the roofs and beams all the way up.
- **Treasure Vault** (gym 27, in the new land): the vault door stays shut until you find **three golden keys**, each in a **Golden Key Chest** hidden within about 40 blocks of the vault. **Dig:** look for a gold X on the ground and dig straight down 10 blocks (jump and place a block under you to climb out). **Build:** one chest sits in the middle of the vault's roof; the roof is too strong to break, so build a pillar next to the wall and step across. **Explore:** a dark tunnel hole leads down and round a corner to a little chamber. Click or tap a chest to open it. Three lights above the door show how many keys you have, and a little gold key in the corner of the screen glints faster the closer you get to a missing key. Keys belong to you (like badges), so they also open the vault in a friend's world.
- Every type also has one rare creature that never evolves, like Lanterboo the lantern ghost, Clawdio the jukebox crab or Chromacurl, a lizard that slowly changes colour.
- **Restaurant** (gym 28, in the south): beat the waiter and the cook, then **Chef Basil** gives you an order, like "Table 2 (blue) wants Berry Pie! I need 🫐 🍯 🌰". Ingredients come from the world: break the leaves of any tree for berries, flower bushes for honey, pine trees for pine nuts, glowcaps in caves, snow, cactuses, star crystals. The ingredients show in the top-right corner and **glow faster the closer you get** to one; a tick means you have it. You only need each one once; they stay yours. Then tap the pot in the kitchen when it turns **golden** (if it burns, just try again), take the dish to the right table, and the happy customer calls the Chef for a battle. Every rematch is a new dish (one that can be made on your map).
- **Champion's Tower**: a final challenge after all 32 badges, with guards, a coach, Champion Solenne and the legendary Zenithar.
- **Rainbow creatures** are the rarest of all. They only appear in daytime, their colours shimmer, and a message tells you when one is nearby.
- **Evolution**: 67 creatures evolve when they reach a certain level, for example Ampup → Thunderwolf, Moonhop → Lunaroo and Drumbo → Bongorilla.
- **Starter choice**: Emberpup (fire), Sproutle (grass) or Bubbuck (water). Each one evolves at level 16.
- **Turn-based battles** that play out in the world. They include a type-effectiveness chart, same-type bonus, critical hits, priority moves, move effects (see **Moves** below), switching and running away. Your whole team shares the XP.
- **Moves**: 134 moves, at least 4 for every type, and every creature also learns moves from a second type. The buttons say what each move does. When a creature with 4 moves wants to learn a new one, you pick which move to forget (or say "Don't learn"). Older creatures get the new moves one at a time as they level up.
- **Catching**: throw Capture Cubes at wild creatures. Your odds are better when the target has low HP. You start with 10 cubes and find more by winning battles or breaking leaves.
- **Progression**: XP, level-ups, learning new moves and evolution. Your team holds up to 6 creatures; extra catches go to a storage box, where you can sort them (newest, level, name, type), show one type at a time, or let a creature go back to the wild (the Creature Book still remembers it).
- **Creature Book**: press **C** (or the Book button). Every creature you meet in a battle shows its picture, name and type; the ones you haven't met are black shapes. Catch one to fill in its whole page: where it lives, how it evolves, its moves and what it is strong or weak against. It works like a little wiki: tap a creature's name or picture on the team screen to open its page, tap a move to see what it does and who learns it, and tap a type to see all creatures of that type and what it beats. **‹ Back** goes back one page (or back to your team).
- **Attack animations**: every type has its own little animation (fire embers, water bubbles, sparks, music notes, rattling bones...), the sixteen signature moves have special ones, and moves that heal, boost, lower or put to sleep show it too. Turn them off with **Effects** on the pause screen if your device feels slow.
- **Sound effects**: soft, short sounds for building, battles, catching and badges. Sound-type creatures have their own tunes (Dinglet rings, Gongolin goes BONG, Drumbo drums), their moves sound special, and in the wild they sing every few seconds when you are near, with music notes floating up so you can spot them. Turn them off with the **Sound** button on the pause screen.
- **Weather** changes every few minutes and depends on where you are: rain, thunderstorms, snow in cold places, sandstorms in the desert (bones peek out of the sand), misty swamp mornings, shooting stars on clear nights, and a rainbow after rain. Each kind brings out more of some creatures: storms bring electric ones, rain water ones, snow ice ones, and rainbows make rainbow creatures much easier to find, and shooting stars bring aliens as well as cosmic creatures. Slime creatures love rain, paper creatures hide indoors when it rains or storms, sky creatures ride the storm winds, and light and sky creatures visit the rainbow.
- **Auto-save** to this device, plus **online saves** when you sign in (see below). This saves your world edits, team, badges, cubes and position.

Creatures farther from the starting point are higher level. Your team slowly regains HP outside of battle.

## Moves

Every move has one small effect at most. The battle buttons say what a move does.

| Move effect | What it does |
| --- | --- |
| Heals you | Gets back half of your HP (Rest Up, Sap Sip, Shimmer, Goo Patch, Rewind, Hot Cocoa, Snack Time) |
| Raises your attack / defence | One step up, up to 3 steps (Pump Up, Hunker Down, Deep Focus, Iron Wall, Lie Low, Firewall) |
| Lowers the foe's attack / slows the foe | One step down (Grumble, Silk Wrap, Chill Wind, Ink Splat, Bling!, Upside Down...). "May" means it only sometimes works |
| May make the foe flinch | If you move first, the foe may lose its move (a few moves, like Fast Forward, always go first) |
| Puts the foe to sleep | The foe skips 2 or 3 moves and gets hurt a bit more while it sleeps. Three hits in a row (a multi-hit move) wake it up. After waking it gets one move that can't be slept away (Lullaby, Sweet Dreams, Big Bong, Snooze, Bedtime Story). Sleepy creatures are easier to catch |
| Hits 1 to 5 times | Several small hits, most often 2 or 3; Thousand Cranes always hits 3 to 5 (Seed Volley, Rivet Shot, Meteor Shower, Confetti, Rapid Click, Pillow Fight, Gem Toss, Floaty Bits) |
| Hurts you a little too | A big hit with a little recoil. It never knocks you out (Inferno Dash, Drake Charge) |
| Never misses | Always hits (Mind Trick, Color Splash and the special moves) |

### Big moves

Every type has 2 or 3 **big moves**. Creatures learn them from level 21 on (Lv 21 to 34), and only the late gym leaders use them, so you meet them as a surprise. Each one is a big decision: it helps a lot, but it costs something.

| Big move | What it does | The price |
| --- | --- | --- |
| Team boost (Go Team Go!, Hive Hum...) | Your whole team, also the friends waiting, gets +1 attack until the battle ends | Your defence goes down 2 |
| Team shield (Stand Together, Leafy Roof, Stone Fort...) | Your whole team takes 30% less damage for 3 turns | You rest on your next turn |
| Risky hit (Wild Blaze, Live Wire...) | Power 60. Half the time it hits 3 times as hard | The other half it hurts you instead |
| Goodbye (Wave Goodbye, Seed Gift...) | You faint, and the next friend comes in with full HP and +1 attack | You are out, and it only works if a friend can come in |
| Curse (Static Fuzz, Big Freeze...) | May slow every foe, also the ones waiting, until the battle ends | Works only 4 times out of 10 |
| Field (High Tide, Snow Day, Garden Bloom...) | One type is 50% stronger for 5 turns | The foe gets the boost too! |
| Last word (Never Give Up, Last Ember, Cliff Crash...) | Power 140 and never misses | Only works when you have less than 1/4 HP left |

Stat changes and sleep go away when a creature is switched out. A few creatures learn a **special move** (Blazehound, Tidalord, Grovebeast, Gongolin, Kitegale, Slimperor, Lumitower, Origrane, Clangalarm, Statuo, Pixbit 2.0, Dozeram, Crownguard, Teetertower, Socktacular, Topsyturvy (Head Over Heels), Scrawlbert (Crayon Storm) and Whirlwhisk (Leaf Whirlwind) at Lv 30, Zenithar at Lv 45). Some moves were renamed to original names (Bump, Belly Bash, Cinder, Bubble Pop, Zap, Blaze Burst, Snow Storm, Nibble, Shadow Dash). Player battles need both players to have the latest version of the game.

## Types

| Type | Strong against | Notes |
| --- | --- | --- |
| Normal | — | Can't hit ghosts at all; bones bounce its bonks, aliens surprise it, and bonks bounce off shiny gold |
| Fire | Grass, ice, bug, metal | |
| Water | Fire, rock, bone, cyber | Soggy bones, and water shorts out cyber creatures |
| Grass | Water, rock | |
| Electric | Water, sound, alien | Zaps break space gadgets, but bones don't carry zaps |
| Rock | Fire, electric, ice, bug | |
| Ice | Grass, bug, drake | A warm cozy blanket keeps the cold out |
| Bug | Grass, mind, time, cyber, cozy | A bug in the clockwork, a bug in the computer, and moths eat wool |
| Ghost | Ghost, mind, rainbow, cosmic | Can't hit normal creatures. Weak to cozy (nothing is scary at home) |
| Mind | Toxic, drake, cosmic | Psychic powers |
| Metal | Ice, rock, pixie | Very tough; toxic attacks don't affect it |
| Toxic | Grass, pixie, cozy, treasure | Stains blankets and tarnishes gold. Can't hurt metal; bones have no tummy to upset |
| Pixie | Drake, ghost | Drake attacks don't affect it. Weak to treasure (pixies love shiny things) |
| Drake | Drake, bone | Powerful dragons, resist fire, water, grass and electric; they love chewing bones. Treasure distracts them with gold |
| Rainbow | Ghost, toxic, mind | Very rare |
| Cosmic | Rock, drake, sound, time | Stars and space (space bends time); come out at night |
| Sound | Ice, bug, mind, alien, camo, ninja | Loud and musical; alien ears are super sensitive, an echo finds a hiding camo creature and a noise gives a ninja away |
| Bone | Ghost, electric, alien | Skeletons aren't scared of ghosts, a bone bonk breaks a battery, and aliens have never seen a skeleton. Weak to water and drake |
| Alien | Normal, metal, toxic | Ordinary creatures have never seen a spaceship, tractor beams lift metal, and aliens slurp up goo for science. Weak to bone, electric and sound |
| Sky | Fire, paper, pixie | Wind blows out flames and blows paper and little pixies away. Weak to electric, ice and slime (sticky goo glues wings) |
| Slime | Metal, sky, sound | Goo gunks up gears, glues wings and muffles sound. Weak to grass, light (sunshine dries it up) and paper (like a paper towel). Slime gunks up treasure |
| Light | Ghost, slime, cosmic, camo, ninja | Light chases away ghosts, finds a ninja in the shadows, dries up slime, spots camo creatures and outshines the stars. Weak to toxic (smog), cosmic (black holes gobble light) and paper (a lampshade) |
| Paper | Rock, slime, light | Paper covers rock, soaks up slime and blocks the light. Weak to fire, metal (scissors) and sky (wind) |
| Time | Metal, paper, slime | Old paper crumbles, metal rusts and slime dries up over time. Weak to bug (a bug in the clockwork) and cosmic (space bends time). Time attacks don't do much to other Time, cosmic or ghost creatures |
| Camo | Bug, mind | Camo sneaks up on bugs, and minds can't find it. Weak to light (it gets spotted) and sound (an echo finds it). Normal, grass and mind attacks have a hard time hitting it, and metal and light creatures shrug off its attacks |
| Cyber | Metal, mind, paper, treasure | Cyber hacks metal and minds, goes paperless and cracks the safe. Weak to water (it shorts out) and bug (computer bugs crash it). Electric attacks barely hurt it |
| Cozy | Ice, ghost, cyber | Cozy warms up ice, nothing is scary at home, and you put the screens away to cuddle. Weak to bug and toxic (moths eat wool, and stains) and treasure (gold outshines a blanket). Ice attacks and Cozy attacks don't do much to it |
| Dream | Food, time, rainbow | Held together by nothing: Dream creatures float apart and bob on their own, and live only in the Dream realm. Dreams are more colourful than rainbows, and dream food is gone when you wake up. Weak to light, time and parkour (a runner jumps out of a dream). Dream, light and cyber attacks, and a bit of cozy and mind, don't do much |
| Treasure | Drake, pixie, cozy | Shiny gold distracts drakes and pixies and outshines a blanket. Weak to toxic (tarnish), slime (gunk) and cyber (a hacker cracks the safe). Normal and Treasure attacks barely hurt it |
| Food | Squad, alien, treasure | A pizza party breaks up the squad, aliens love a snack, and food is worth more than gold. Weak to fire (burnt), bug (ants!), toxic and dream (dream food is gone when you wake up). Ice attacks don't do much (it is already chilled). |
| Squad | Parkour, camo, normal | A crowd blocks the runner, many eyes find a camo creature, and a team beats one on its own. Weak to electric, sound and food (a pizza party breaks up the squad). Squad, sky and slime attacks barely hurt it; ghost attacks are weak against it. Squad creatures get weaker as they get hurt: moves that hit many times are great against them |
| Parkour | Dream, bone, cyber | A runner jumps right out of a dream, outruns skeletons and beats a video game. Weak to grass (vines trip it) and squad (a crowd blocks the way). Parkour, sky and ghost attacks don't do much to it |
| Ninja | Mind, paper, squad | A ninja sneaks past a mind, cuts paper and picks a squad off one by one. Weak to light (no shadows to hide in) and sound (a noise gives it away). Ghost and camo attacks don't do much to it (they know all its hiding tricks); its own attacks bounce off metal armour, bright light and other ninjas |
| Tiny | Racer, food, cyber | Ants get into the picnic and the wires, and a tiny one jams a racer's engine. Weak to fire, sky (a gust blows it away) and ball (squashed!) |
| Pirate | Ball, treasure, water | A pirate's hook pops the ball, grabs the treasure and rules the waves. Weak to electric (a shock on deck) and racer (outrun!) |
| Racer | Pirate, time, parkour | A racer outruns the pirate, beats the clock and the runner. Weak to water (a wet track skids), ice and tiny |
| Ball | Tiny, squad, bone | A ball squashes the tiny, bowls over the squad and knocks the bones down like pins. Weak to grass, pirate and ninja |

Cosmic beats sound, sound beats mind, and mind beats cosmic. Sky beats paper, paper beats light, light beats slime, and slime beats sky. Cozy beats cyber, cyber beats treasure, and treasure beats cozy. Food beats squad, squad beats parkour, parkour beats dream, and dream beats food. Mind and cosmic attacks are weak against aliens (space is their home).

## Gyms and badges

There are 32 gyms, one for each type except normal: every gym of our world. 29 are scattered around the map, one is inside the **Dream realm**; the **Cozy Gym** has no building (it moves into your home) and the **Treasure Vault** is locked until you find its keys. The later ones are special: the **Fossil Gym** and the **Goo Gym are deep inside caves** (follow the arrow to the stone arch and walk down the stairs), the **Cloud Gym** and the **Saucer Gym float high in the sky**: find the blue (Cloud) or green (Saucer) pad on the ground below, build a tower of blocks on it and jump across. Two gyms only open at night: the stargazers of the **Comet Gym** (with star hats) and the aliens of the **Saucer Gym** (green and purple, with antennae; their flying saucer lands on the roof). By day the arrow skips them and tells you they open at night. The three newest gyms are in the new land (east and south of the old map) and each has its own trick: the **Clock Tower** has doors that only open at certain times of the day (look at the big 24-hour clock on its front), the **Hidden Hill** is a hill with no arrow once you get close (look for a door behind a bush; its trainers hide as stone pillars), and the **Firewall Maze** has three rooms of laser walls (step on a switch to turn off the lasers of its colour, press the green reset button if you get mixed up, and a friend can open the purple lanes by standing on a friend pad; after the leader, a door in the server room's side wall opens: this way out!). Each gym is a building with a roof in its type's colour. **Gym walls are too strong to break, and you can't build inside a gym** (building next to one is fine). The closer a gym is to the start, the easier it is:

| # | Gym | Type | Leader | Leader's levels |
| --- | --- | --- | --- | --- |
| 1 | Boulder Gym | Rock | Leader Rocco | 6–8 |
| 2 | Hive Gym | Bug | Leader Mantis | 8–10 |
| 3 | Swamp Gym | Toxic | Leader Venna | 10–12 |
| 4 | Tide Gym | Water | Leader Marina | 12–14 |
| 5 | Twinkle Gym | Pixie | Leader Luma | 14–15 |
| 6 | Grove Gym | Grass | Leader Fern | 15–17 |
| 7 | Volt Gym | Electric | Leader Sparky | 17–19 |
| 8 | Echo Gym (a dance-off with the leader first) | Sound | Leader Melody | 18–20 |
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
| 26 | Cozy Gym (moves into your cozy home) | Cozy | Leader Maple | 42–43 |
| 27 | Treasure Vault (three golden keys) | Treasure | Leader Goldie | 45–46 |
| 28 | Restaurant (cook the Chef's order) | Food | Chef Basil | 47–48 |
| 29 | Big Top Gym (climb the acrobats' pyramid) | Squad | Leader Topsy | 48–50 |
| 30 | Obstacle Course (a tall course of crumbling, blinking, zapping and pushing blocks) | Parkour | Leader Rio | 51–52 |
| 31 | Upside-Down House (inside the Dream realm: sleep in your cozy home's Bed at night, follow the arrow and jump on the bounce block under the house) | Dream | Leader Wimsy | 53–54 |
| 32 | Shadow Dojo (sneak past the guards' lanterns to the pagoda roof) | Ninja | Leader Kage | 54–56 |

Inside each gym is one apprentice trainer (two in the newer gyms) you must beat before the Gym Leader will battle you. Trainer battles use 2–3 creatures in a row, and you can't catch their creatures or run away. Beating a leader earns that gym's badge and 5 Capture Cubes. Collect all 32 to open the Champion's Tower. Beat a leader again for a rematch: they ask first, get stronger every time (and may bring more creatures), and you win Capture Cubes!

The **Cozy Gym** has no building: it moves into *your* home! Build a finished **Cozy home** (see **Homes**) and catch 3 different cozy creatures (blanket bunnies, mitten kittens and friends). Then someone knocks on your door: Leader Maple and her two friends move in. Talk to them to battle (the two friends first, then the leader). Keep your home cozy! If it stops being cozy (the bed is gone, or gems replaced too much wood) they say "Brr, it's chilly in here! Can you fix it?" and won't battle until you fix it. If you move your Doormat they come with you, and if you break it they go away and come back when you have a cozy home again. Only the home of the world's owner counts, but friends who play together can come in and battle there too.

The top-right corner shows your badges and points you to the next gym. Catch creatures that have a type advantage before each one. **Healer Hana**, standing next to your starting point, fully heals your team.

## Champion's Tower

After you collect all 32 badges (the top-right corner shows them in 4 rows of 8), the **Champion's Tower** opens. It is a tall stone tower with a rainbow roof and a glowing crystal on top, near the middle of the map (the arrow in the top-right corner shows the way). Inside:

- **Nurse Poppy** heals your team. **Coach Dex** trains you with 3 creatures at your best level and gives **double XP** (and 1 Capture Cube) every time.
- **Guard Bram** (Lv 57–59) and **Guard Opal** (Lv 58–60) must be beaten first, one after the other.
- **Champion Solenne** has 6 creatures (Lv 59–62). Her last one is **Zenithar**, a one-of-a-kind rainbow guardian. It can't be caught, and it **powers up** when it is down to half its health!
- If you win, you become the **Champion**: you get 20 Capture Cubes, a gold "Champion" title on the screen, and the win is saved. You can challenge Solenne again any time (her creatures are 3 levels stronger).
- If you lose, you wake up at the start, with a hint. Heal with Nurse Poppy and train with Coach Dex, then try again.
- After 16 badges, wild creatures are also 10 levels stronger, so there is always something to train against.
- Champions keep their title, but the tower waits until they have every badge again.

## Champion missions

Once you are the **Champion**, talk to Champion Solenne again: she gives you **missions**, one at a time (M shows them any time; a small chip in the corner reminds you what you are doing). Finish one, go back to her for the next. Not in the mood? **Do a different one** swaps it. The first 12 are made by hand; **after that the missions never end**: she keeps making new ones, in rounds of 6 (two treasure maps, a build, a catch, a rematch or another build, and a giant). The panel counts them (*Mission 15 · 14 done*). Your list is the same on every device. The giants **grow a little every round**.

- **Treasure map**: you get a piece of an old map with a picture of the ground and a red **X**, and words that tell you where to start and how many steps to walk. The chip says *cold, warm, hot* as you get closer. Stand on the X and **dig 2 blocks down** (stand in the hole) to find the treasure. The X is the same for everyone in the same world.
- **Build challenge**: build something (a Lamp Tower, a Water Bridge, a Rainbow Wall, a Star Tower). A list shows what is still missing; the game checks your build by itself, or press **Check my build**. Only blocks you placed yourself count.
- **Giant battle**: two players against one giant creature (play together, stand close, ask your friend to help). Both of you battle at once; your creatures are copies, so nobody's real team gets hurt. The friend who helps gets a prize too. If you have no friend to play with and only giants are left, Solenne gives you other missions first.
- **Catch a creature** (after the first 12): "Catch a Fire creature". The card tells you which places to look in and links to the Creature Book. Only a creature you catch while the mission is on counts. Prize: 8 Capture Cubes and 2 Star Blocks.
- **Gym rematch** (after the first 12): "Beat the Boulder Gym again". Win a rematch there. Prize: 5 Capture Cubes and 2 Rainbow Bricks.
- The later treasure maps use new X spots (24 of them); builds get new shapes (towers with a Lamp, Crystal or wool colour on top, long walls, Glow Towers...). Maps and builds wait while you are in a dream: do them back in the normal world.

Prizes are Capture Cubes and three **rare mission blocks** you can only get this way: **Star Block** (treasure maps), **Rainbow Brick** (builds) and **Giant Trophy** (giant battles). They work like gems: placing uses one, breaking one gives it back. Missions are saved per player.

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

**Follow your friend into the Dream or the Swirl**: when the host goes to sleep and dreams (or steps through the Portal Door into the Swirl), the visitor is asked "Dad is dreaming. Dream together?" and can say **Follow** or **Not now**. Not now is fine: later there is a **Follow ...** button in the pause screen's Play together box, or use a Bed (or the Portal Door) in the host's world. You arrive next to your friend, see each other, build together (what you build there is saved in the host's world) and can earn the realm's badge for yourself. You do not need your own cozy home, a night or the Champion title: your friend's trip is the key. When your friend wakes up or comes back, you do too (after any battle you are in). Duels, giant battles and hide and seek only work when you are in the same place.

A visitor's own world is untouched. **Go back to my world** returns them to it, and that happens automatically if the host stops sharing or leaves. The connection uses Supabase Realtime. Neither player needs to be signed in, but both need an internet connection.

For testing on one computer, add `?mp=local` to the address. Tabs in the same browser then connect to each other directly, without the server.

## Tests

Browser tests (Playwright) are in `tests/`: `cd tests && npm install && npm test`. See `CLAUDE.md` for details.

## Code layout

| File | Purpose |
| --- | --- |
| `src/main.js` | Renderer, input, game loop, save/load, title screen |
| `src/world.js` | Terrain generation, block storage, chunk meshing, voxel raycast |
| `src/realms.js`, `src/dreamland.js`, `src/dreamhouse.js` | Realms (the Dream realm): going there and back, the island route for the arrow; the Dream's islands, Bounce Blocks and giant things; the Upside-Down House gym |
| `src/portal.js`, `src/swirlland.js`, `src/pictureworlds.js` | The Portal Door beside the tower, the Swirl realm (decks, stairs, lift streams, picture frames, star bridge, the Wizard's tower), the list of Picture Worlds and stars |
| `src/giantland.js`, `src/houselive.js` | The Giant House (Picture World): the kitchen as data (counter, shelf, fan, table, cookie, bench and cat, toy track, mouse hole, keyhole, crumbs, nooks for Tiny creatures) and its gadgets (fan wind, toy train, tap water and bottle cap, the sleeping cat, crumbs) |
| `src/blocks.js` | Block definitions and the procedurally drawn pixel-art texture atlas |
| `src/player.js` | First-person movement and collision |
| `src/species.js` | Types, moves, species data, stats/XP, blocky creature models |
| `src/gyms.js` | Gym, leader and trainer data, and the Champion's Tower |
| `src/npc.js` | Blocky people: trainers, leaders and the healer |
| `src/gymlive.js`, `src/daytime.js` | Parts of a gym that change while you play (the Clock Tower's doors, the Firewall Maze's lasers) and the Clock Tower's times of day |
| `src/clocktower.js`, `src/hiddenhill.js`, `src/firewall.js` | The Clock Tower, Hidden Hill and Firewall Maze gyms (building and live parts) |
| `src/missiongen.js` | The mission maker (T38c): the missions after the first 12, made the same way on every device from your world's seed (rounds of 6, pools of catch types and rematch gyms, growing giants) |
| `src/missions.js`, `src/treasuremap.js`, `src/buildcheck.js`, `src/features.js`, `src/missionui.js` | Champion missions: the list and rewards, treasure map spots from the seed and the map picture, build challenges, the shared block checks (also used by homes), and the missions panel and chip |
| `src/bigtop.js` | The Big Top Gym (Squad, a circus tent with a three-tier pyramid) |
| `src/homegym.js`, `src/treasurevault.js` | The Cozy Gym (moves into your home) and the Treasure Vault (golden keys) |
| `src/restaurant.js` | The Restaurant: building, the pot, orders, ingredients, serving |
| `src/obstaclecourse.js` | The Obstacle Course (Parkour gym): platforms, beams, crumble / blink / zap blocks, pushers and springs over a soft mat, checkpoint flags |
| `src/shadowdojo.js`, `src/sneak.js` | The Shadow Dojo (Ninja gym): the garden, hall and pagoda, and the sneaking pieces (watchers with lantern light, hiding spots, squeaky boards, stone lanterns) |
| `src/creatures.js` | Wild creature spawning and wandering AI |
| `src/homes.js`, `src/roomfinder.js`, `src/hometypes.js`, `src/homeui.js` | Homes: who owns which Doormat, the room finder, the Cozy / Treasure home types, and the meter, red gaps and preview |
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
