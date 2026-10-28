// The kind help of every Picture World skill game (owner 2026-10-28): each miss in a row of the same round / race / shot makes the
// next try only ever so slightly easier, and only after a couple of misses, so the games still ask for a bit of grit and patience
// ("with the shield game, after failing 6 times it became pretty easy"). Pure, no imports, Node-runnable.
//
// The ONLY numbers are in KIND_HELP: change them here and every game changes at once.
//   after  misses before any help (0 and 1 miss: none)
//   step   ease added per miss from then on
//   max    the most it ever eases (a share: 0.10 = 10 % easier at most)
// With { after: 2, step: 0.02, max: 0.10 }: misses 0 1 2 3 4 5 6+  ->  ease 0 0 .02 .04 .06 .08 .10
//
// kindHelp(misses) -> { misses, ease, on, slow, more }: slow = 1 - ease (a speed factor), more = 1 + ease (a time / size factor).
// Each game maps it onto its own levers (a small adapter in the game's own file); a rematch's `hard` is separate and stays as it was.
//
//   game                       what counts as a miss                      the levers (e = ease)
//   Race Track (racetrack.js)  a lost race                                Rio's speed x (1 - e)
//   Ball Stadium football      a kicked ball put back without a goal      Defender Dee and the keepers' dives x (1 - e), the green of the
//     (stadiumlive.js)                                                     power ring x (1 + e) round its middle
//   Ball Stadium basketball    a Shoot! that does not go in               the good moment of a shot x (1 + e)
//   Bumper Cars (fairgames.js) a round whose time ran out                 bots x (1 - e), round time x (1 + e)
//   Balloon Bounce             a round whose time ran out                 balloons x (1 - e), round time x (1 + e)
//   Gold Ring Ride             a lap short of its points                  carousel x (1 - e)
//   Piñata Party (pinata.js)   a round whose time ran out                 swing period x (1 + e), balloons' drift and zips x (1 - e)
//   Jack Catch (jackcatch.js)  a round short of its points                flights and gaps x (1 + e), landing jumps and pie share x (1 - e)
//   Gift Stack (giftstack.js)  a toppled stack                            crane x (1 - e)
//   Pop-Up Whack (popupwhack)  a round short of its points                jacks stay up / (1 - e), round time x (1 + e)
//   Shield Up! (siege.js)      a round short of its blocks                every throw's timing / (1 - e), shield cover x (1 + e)
//   Joust (joust.js)           a round short of its points                meeting time, star size and the hop's warning x (1 + e),
//                                                                           the star's slide x (1 - e)
//   Bubble Stairs (bubbles.js) a fall from a bubble                       a bubble's life and how long you may stand on it x (1 + e),
//                                                                           the drips x (1 - e)
//   Ducklings (bubbles.js)     a duckling's bubble popped on a thorn      currents x (1 - e), the glide stops x (1 + e) sooner, the nest x (1 + e)
//   Chimney Ride (bubbles.js)  the ride's bubble popped                   the sink x (1 - e), the spike gaps x (1 + e), the bar x (1 - e)
//   Shields (bubbles.js)       a vent's bubble that flew past             the shield's catch x (1 + e)
export const KIND_HELP = { after: 2, step: 0.02, max: 0.10 };

export class KindHelp {
  constructor(p = KIND_HELP) { this.p = p; } // (reads the numbers live, so a change of KIND_HELP is seen by every game)
  ease(misses) {
    const m = Math.max(0, Math.floor(Number(misses) || 0)), { after, step, max } = this.p;
    return m < after ? 0 : Math.min(max, step * (m - after + 1));
  }
  on(misses) { return this.ease(misses) > 0; }
  of(misses) { const e = this.ease(misses); return { misses: Math.max(0, Math.floor(Number(misses) || 0)), ease: e, on: e > 0, slow: 1 - e, more: 1 + e }; }
}
export const KIND = new KindHelp();
export const kindHelp = misses => KIND.of(misses);
