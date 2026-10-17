# T25 move table (draft for the owner to check)

Decisions taken by default (change any time before T25 is built):
- "Gold Rush" is already the Treasure T2 move, so the new Treasure field move is **Treasure Hunt** (`treasurehunt`).
- "Screech" is a real move name elsewhere, so the Sound curse is **Ear Ringer** (`earringer`).
- Ids are lowercase with no separators and never a `sound.play()` name (`levelup` is a sound, so Cyber's "Level Up!" is `levelboost`).
- Trainer and wild creatures never get these moves from the automatic "last 4 learned" pick; gyms name them on purpose.

Learned by every creature of the type (a `BIG` table appended in `L()`), levels by kind:
shield 21, rally 22, curse 24, field 26, risky 29 (power 60, 50%: x3, else hits you for 60), sacrifice 32, lastword 34 (power 140, sure, only below 1/4 HP).

| Type | Kind | Name | id | Book text |
| --- | --- | --- | --- | --- |
| Normal | rally | Go Team Go! | goteamgo | Whole team hits harder. You get softer. |
| Normal | shield | Stand Together | standtogether | Team takes less damage. You rest next turn. |
| Normal | lastword | Never Give Up | nevergiveup | A huge hit! Only when you are almost out. |
| Fire | risky | Wild Blaze | wildblaze | Half the time: triple hit! Or it burns you. |
| Fire | lastword | Last Ember | lastember | A huge fire hit, only when almost out. |
| Water | sacrifice | Wave Goodbye | wavegoodbye | You leave. Next friend comes in fresh and strong. |
| Water | field | High Tide | hightide | Water moves are stronger for 5 turns. Foes too! |
| Grass | shield | Leafy Roof | leafyroof | Leaves cover the team. You rest next turn. |
| Grass | sacrifice | Seed Gift | seedgift | You leave. Next friend comes in fresh and strong. |
| Grass | field | Garden Bloom | gardenbloom | Grass moves are stronger for 5 turns. Foes too! |
| Electric | risky | Live Wire | livewire | Half the time: triple hit! Or it zaps you. |
| Electric | curse | Static Fuzz | staticfuzz | Might slow down the whole foe team. |
| Rock | shield | Stone Fort | stonefort | Team takes less damage. You rest next turn. |
| Rock | lastword | Cliff Crash | cliffcrash | A huge rock hit, only when almost out. |
| Ice | curse | Big Freeze | bigfreeze | Might make the whole foe team slow and chilly. |
| Ice | field | Snow Day | snowday | Ice moves are stronger for 5 turns. Foes too! |
| Bug | rally | Hive Hum | hivehum | Whole team hits harder. You get softer. |
| Bug | curse | Cobweb Tangle | cobwebtangle | Might slow down the whole foe team. |
| Ghost | sacrifice | Poof! | poof | You go poof! Next friend comes in fresh. |
| Ghost | curse | Spooky Shiver | spookyshiver | Might make the whole foe team slow. |
| Mind | shield | Mind Bubble | mindbubble | A bubble guards the team. You rest next turn. |
| Mind | curse | Slow Thoughts | slowthoughts | Might slow down the whole foe team. |
| Mind | field | Think Tank | thinktank | Mind moves are stronger for 5 turns. Foes too! |
| Metal | shield | Metal Umbrella | metalumbrella | Team takes less damage. You rest next turn. |
| Metal | risky | Wrecking Ball | wreckingball | Half the time: triple hit! Or it bonks you. |
| Toxic | risky | Fizzy Potion | fizzypotion | Half the time: triple hit! Or you drink it. |
| Toxic | curse | Stinky Fog | stinkyfog | Might slow down the whole foe team. |
| Pixie | rally | Sparkle Cheer | sparklecheer | Whole team hits harder. You get softer. |
| Pixie | shield | Daisy Ring | daisyring | Flowers guard the team. You rest next turn. |
| Drake | rally | Brave Bellow | bravebellow | Whole team hits harder. You get softer. |
| Drake | lastword | Scale Storm | scalestorm | A huge drake hit, only when almost out. |
| Rainbow | shield | Prism Dome | prismdome | Colors guard the team. You rest next turn. |
| Rainbow | field | Color Carnival | colorcarnival | Rainbow moves are stronger for 5 turns. Foes too! |
| Cosmic | risky | Lucky Star | luckystar | Half the time: triple hit! Or it hits you. |
| Cosmic | field | Starry Night | starrynight | Cosmic moves are stronger for 5 turns. Foes too! |
| Cosmic | lastword | Big Bang | bigbang | A huge space hit, only when almost out. |
| Sound | rally | Battle Song | battlesong | Whole team hits harder. You get softer. |
| Sound | curse | Ear Ringer | earringer | Might slow down the whole foe team. |
| Bone | sacrifice | Fall to Pieces | falltopieces | You fall apart. Next friend comes in fresh. |
| Bone | lastword | Dino Comeback | dinocomeback | A huge bone hit, only when almost out. |
| Alien | risky | Mystery Button | mysterybutton | Half the time: triple hit! Or it hits you. |
| Alien | curse | Slow-Mo Ray | slowmoray | Might slow down the whole foe team. |
| Sky | shield | Cloud Cushion | cloudcushion | Clouds guard the team. You rest next turn. |
| Sky | field | Windy Day | windyday | Sky moves are stronger for 5 turns. Foes too! |
| Slime | shield | Jelly Wall | jellywall | Jelly guards the team. You rest next turn. |
| Slime | sacrifice | Melt Away | meltaway | You melt away. Next friend comes in fresh. |
| Light | rally | Shine Bright | shinebright | Whole team hits harder. You get softer. |
| Light | field | Daylight Glow | daylightglow | Light moves are stronger for 5 turns. Foes too! |
| Paper | rally | Pep Poster | pepposter | Whole team hits harder. You get softer. |
| Paper | sacrifice | Fold Away | foldaway | You fold up. Next friend comes in fresh. |
| Time | field | Rush Hour | rushhour | Time moves are stronger for 5 turns. Foes too! |
| Time | lastword | Last Second | lastsecond | A huge hit, only when almost out. |
| Camo | risky | Sneaky Leap | sneakyleap | Half the time: triple hit! Or you trip. |
| Camo | sacrifice | Decoy Swap | decoyswap | You leave. Next friend comes in fresh and strong. |
| Cyber | rally | Level Up! | levelboost | Whole team hits harder. You get softer. |
| Cyber | curse | Lag Spike | lagspike | Might slow down the whole foe team. |
| Cyber | field | Wi-Fi Zone | wifizone | Cyber moves are stronger for 5 turns. Foes too! |
| Cozy | shield | Group Hug | grouphug | A hug guards the team. You rest next turn. |
| Cozy | sacrifice | Tuck In | tuckin | You go to bed. Next friend comes in fresh. |
| Treasure | risky | Jackpot | jackpot | Half the time: triple hit! Or it hits you. |
| Treasure | field | Treasure Hunt | treasurehunt | Treasure moves are stronger for 5 turns. Foes too! |

Kind counts: rally 8, shield 10, risky 8, sacrifice 8, curse 9, field 11, lastword 7.

Late gyms (leaders only, one creature each gets a named move; gyms 20 and 21 get none):

| Gym | Leader creature: move |
| --- | --- |
| 22 Cloud Gym | kitegale: Windy Day |
| 23 Clock Tower | clangalarm: Last Second |
| 24 Hidden Hill | statuo: Decoy Swap |
| 25 Firewall Maze | error404: Lag Spike; clickit2: Level Up! |
| 26 Cozy Gym | snoozebear: Group Hug; dozeram: Tuck In |
| 27 Treasure Vault | kingcoin: Jackpot; crownguard: Treasure Hunt |
