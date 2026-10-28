# T47 (proposal, not built) · The Portal Lab: both swirls yours, anywhere

Owner, 2026-10-27, after testing the Portal House: "Is making the portals double-sided too difficult? We can't ride inside
there anyway, so we could swap the Ride button (R on a laptop) for the other side of the portal. And maybe it could allow us to
teleport not just on those white pads, but anywhere. Of course that'd mean a lot more complex world (maybe not part of the Swirl
but its own world) and more challenging puzzles. If this is possible but still interesting and challenging, it could be great.
If it means an incredible amount of work, then we can pause and think later."

## The short answer

- **Two buttons for the two colours is easy** (the Ride button / R places the orange swirl, the big button / E / a tap the
  teal one; the Ride button already sits unused in the Portal House). About a day of work.
- **But the Portal House's eight rooms were designed around "the pad decides the colour" and fixed orange swirls.** Portals
  are symmetric (in one, out the other), so the colour itself never matters; what matters is *which surfaces can be
  joined*. Today a white pad can never be joined to another white pad. With both swirls yours on any pad, several rooms get
  shortcuts (the high pad straight to the exit pad), and with swirls "anywhere" every room is solved by two taps. So the
  House would have to be redesigned anyway: that is the "lot more complex world" the owner guessed.
- **So the honest plan is a new place built for it**, and leaving the Portal House as the friendly introduction it is.

## The proposal: the Portal Lab

A Picture World of its own (it takes a free frame, `secret4`: no save can hold its star, like Doodle and Atlantis did; owner 2026-10-28: `secret3` went to the Castle, `plans/T49-castle.md`), or a
bonus wing of the Portal House without a star (owner to choose, see below).

- **Both swirls are yours.** Teal: the big button / E / a tap. Orange: the Ride button / R (on touch the Ride slot shows
  "Orange" while you are in the Lab; it is never empty, fixed-slot rule T39c). Firing again moves that colour's swirl.
- **"Anywhere" means any surface of one kind of block**, like the famous games: smooth white **lab panels** take a swirl,
  dark **metal** never does. That rule *is* the puzzle: the child looks for the white surfaces. Every other block in the Lab
  is metal, glass (you see through it, a swirl will not stick) or a moving thing.
- **New puzzle pieces** (each a closed form of the room clock, like the House): a laser you guide through your swirls to a
  receiver (opens a door), a heavy cube you carry and drop through a swirl onto a button, light bridges, moving panels,
  a "fling" room built on the House's speedy in / speedy out.
- **About 10 test chambers, gentle to hard**, each with a sign of what is new in it. The last one opens the Boss's room.
- **Checks like the House's:** `tests/portalcheck.mjs` grows a solver (a BFS over "where can I stand / which panels can I see
  from there") that proves every chamber is solvable and that no chamber is solved by a short cut we did not intend.

## Cost

Bigger than one of the wave 15 worlds: about the size of T42 (the Portal House) plus the solver. Roughly 2 to 3 long sessions.

## Decisions for the owner (my defaults in brackets)

1. A new Picture World with its own star in a `secret` frame, or a starless bonus wing? (A Picture World: then it has a
   Boss and a new type, like every other world; the 12 stars stay 12 only if it replaces a secret frame, which it does.)
2. Keep the Portal House exactly as it is? (Yes: it teaches the idea gently.)
3. Should the Portal House get the two buttons now anyway, only in rooms 5-8 where both ends are already yours? (No:
   white pad to white pad would open short cuts there; better to keep the two-button wand for the Lab.)
