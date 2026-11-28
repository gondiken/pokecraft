# Games for two friends: the next three (decided 2026-11-28, NOT built)

The owner chose these on 2026-11-28 and asked for them to be built **in a fresh session**. Nothing below exists yet.
Read CLAUDE.md "Games for two friends" first: it describes the layer all of this sits on.

## What the owner said

- **Score duels are out** ("don't sound fun tbh"): no "each plays alone, compare scores" games.
- **Parkour race**: the Obstacle Course, raced directly against each other. In the game it is called **"Parkour race"**.
- **Bounce-Back for two** (the Mirror Palace's court): good idea.
- **Bumper Cars for two**: good idea; "I guess there should be other cars still".
- **The trip applies to all of them**: asked for anywhere, both are taken to where the game is, and back afterwards
  (the same as football / basketball / the kart race today).
- **Not now:** the treasure-hunt race, the build contest, tag / hide and seek for 3+ players.

## What already exists to build on

- `src/friendgames.js`: a new game = one `FriendGame` subclass + one `addFriendGame({ id, icon, name, sub, ask, shown,
  whyNot, make, place, arrive, where })`. Asking, yes / no, the heartbeat, lost-message healing, Stop, the trip there
  and back, hiding the friend's lead creature, and "E only does the game's thing" all come for free.
- The trip: a kind with `place` is offered anywhere once the host is a Champion; `newTrip(def)` builds
  `to = { place, arrive, up: { via: arrive } }` and `realms.trip(to)` jumps there. `realms.trip` also takes
  `to.pos = [x, y, z, yaw, pitch]` (stand exactly there), which the three new games need (see below).
- `src/sharedball.js` + `matchrules.js` `ballFrame`: one object on two computers, owned by whoever touched it last.
- `src/kartduel.js`: the pattern for "each on their own screen, the friend drawn from their avatar".
- Spec `friend-games` (`FRIEND_ONLY=rules|tag|sports|ipad|trip`): add a part per game; two browsers with `openPair`.

## 1. Parkour race (the Obstacle Course, gym 30, slot 7, main world)

- Files: `src/obstaclecourse.js` (`PIECES`, `FLAGS`, `CourseLive` = `LIVE.course`, its `clock`, falls go back to the
  furthest flag).
- Rules to build: both start on the start platform, 3-2-1-Go, first to the finish platform wins. Each runs on their
  own screen (flashing pieces are per player and closed forms of `CourseLive.clock`: start both clocks at Go so
  the course is in the same state for both). A fall = back to your own last flag, as today. The friend is seen as
  their avatar; players do not block each other.
- The gym's own things must step aside during a race, like the keepers do: the two trainers on flags 1-2 and the
  leader on the finish should not start battles (`friendGames.only` already stops E from picking people; check
  walking into them does nothing).
- **Trip:** the place is `'main'`, not a Picture World. `away(def)` already works for `'main'`; `newTrip` needs a
  way to give a spot instead of an `arrive` id, e.g. a def hook `spot(game) -> [x, y, z, yaw]` copied into `to.pos`
  (the course's start comes from `game.world.gyms` -> the gym with `def.id` of the Obstacle Course -> its start
  platform). From inside the main world it is "no trip, just puff to the start" (as football does in Playland);
  write that as a teleport in the kind's `start()`.
- Open question for the owner: is the race allowed before either player holds the Parkour badge? (Suggest: yes, the
  host's Champion title is the only gate, same as the others.)

## 2. Bounce-Back for two (the Mirror Palace court, realm `mirror`)

- Files: `src/bounceback.js` (`BounceRound`: the ball, your mirror on the rail, Copycat Cleo, the spinner;
  `reflect`, `advanceBall`, 1/120 s sub-steps), `src/mirrorlive.js` (the rail stance `railObj`, Play!), `mirrorland.js`
  `COURT` (16 wide, 30 long, Cleo's line at v 28.5, the player's rail at v 1.5).
- Rules to build: the friend takes Cleo's place at the far end with their own hand mirror; first to 3. The shine
  ball is one shared object: reuse the `SharedBall` idea (owner = whoever reflected it last, the leader counts the
  score). `BounceRound` is built around "you vs Cleo", so this likely wants a small two-player round class next to
  it rather than changes inside it; the single-player game must stay bit for bit (`mirrorbots.mjs` checks it).
- Each player sees the court from their own end. Simplest: the far player's view and controls are the mirror image
  (u -> 16 - u, v -> 30 - v) of the same rules, so both feel like "my end is near".
- **Trip:** `place: 'mirror'`, `arrive: 'mirror'`, then `to.pos` / a puff onto the two plates. The court has only one
  rail and plate today (the player's end); the far end needs a second stance spot (a mesh, no block change).
- Cleo, Gwen and Lux step aside during the game.

## 3. Bumper Cars for two (Playland's Funfair)

- Files: `src/fairgames.js` (`BUMPER`, `BumperCar`, `BotFleet` = six bots on ellipses, `BumperGame`), `funfairlive.js`
  (the car as a `carry`), `funfair.js` (the arena).
- **Is the arena big enough? Yes.** It is 29 x 23 blocks (x 120..148, z 142..164); a car is a disc of radius 0.85,
  and today 7 cars drive in it (you + six bots). An eighth car is no squeeze.
- Rules to build (owner: keep the other cars): both friends drive; the six bots keep driving as moving obstacles.
  Suggested scoring: each friend's car carries a balloon on its BACK; bump your friend's car from behind to pop it
  (the same "behind + closing fast" rule as `BUMPER.behind` / `toward`), the balloon comes back after a moment,
  first to 3 or 5 pops. Bots' balloons could count 1 and a friend's 2, or bots carry none: ask the owner.
- Sync: each browser drives its own car (like the karts) and sends its car's position and velocity a few times a
  second; the bots are closed forms of one shared clock started at Go, so both see them in the same place. A pop is
  claimed by the bumper's browser and counted by the leader (the tag pattern: `claim` -> leader's state).
  Car-to-car bounce between the two friends: each browser bounces its own car off the friend's car as it sees it
  (the `ballFrame` idea: the friend is a solid thing on my screen).
- **Trip:** `place: 'playland'`, `arrive: 'fair'`, then both into cars in the arena's bays.

## Shared notes

- Bump `PLAY.VERSION` when a message or rule changes that two different versions could not share.
- Every kind needs `farewell()` if it has a result, `usesFriend` only if looking at the friend is part of the game.
- Tests the owner expects (CLAUDE.md): real keys through the game's loop, two browsers, the iPad; and for anything
  with physics, the rules in Node at 60 and 20 fps.
- Friend menu: with three more kinds there are ten choices. The two-column grid fits seven on an iPad today
  (`friend-menu-ipad.png`); ten needs a look (maybe a "Games" sub-page, or smaller rows).

## Still open from the same conversation (not part of these three)

- The owner noticed blocks can be broken in Playland's middle promenade and on the Sketchbook's pages (only the
  challenge areas are keeps). Offered: lock both worlds fully (anything built or broken there would reset). No
  answer yet; nothing was changed.
- Tag: the runner keeps the usual guide arrow; the owner was offered an arrow to IT for the runner too. No answer yet.
