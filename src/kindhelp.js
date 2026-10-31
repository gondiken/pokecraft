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
//   Fizz Ledges (bubbles.js)   a fall from a bubble                       a bubble lasts x (1 + e) (a longer ride), the drips and the
//                                                                           fizz streams / gusts x (1 - e)
//   Ducklings (bubbles.js)     a duckling's bubble popped (thorn / timer)  currents and gusts x (1 - e), the glide stops x (1 + e) sooner,
//                                                                           the nest x (1 + e), the bubble lasts x (1 + e)
//   Chimney Ride (bubbles.js)  the ride's bubble popped                   the sink x (1 - e), the spike gaps x (1 + e), the bar x (1 - e)
//   Shields (bubbles.js)       a ride (or a landing on a shield's edge) that popped none  the shields x (1 + e) bigger, their sway x (1 - e)
//   Orbikit Chase (orbits.js)  it saw or heard you and ran off            its sprint x (1 - e) (still faster than you), tag reach x (1 + e)
//   Planet Hop (orbits.js)     a flower flight that missed the pebble     the next pebble's pull reaches e x 8 blocks further (gravity.js pad)
//   Moon Ferry (orbits.js)     a jump off the moon that missed every      the moon x (1 - e), the Lens Rocks' pull reaches e x 8 blocks
//                                Lens Rock                                  further (gravity.js pad)
//   Bounce-Back (bounceback.js) a round Cleo won (she got 3 first)        the ball's speed and Cleo's slide and reaction time x (1 - e),
//                                                                           the goal mouth x (1 + e)
//   Looking-Glass Rooms        a plop or a bonk in this room               the bonk balls' and the mop's speed x (1 - e), the ink puddles
//     (lookingglass.js)                                                     x (1 - e) smaller, the gold pads x (1 + e) bigger
//   Moonlit Gallery            a round whose 45 s ran out                  the Gloomies' speed x (1 - e), the time one must be held in the
//     (spotlight.js)                                                        light x (1 - e), the spot of light x (1 + e) bigger
//   (all three through mirrorHelp(misses) in bounceback.js, which is kindHelp(misses) mapped onto those levers)
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
