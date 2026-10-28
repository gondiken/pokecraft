// Owner 2026-10-28: "Games should always be playable once they're completed and the user moves on." The one "for fun" rule of the
// Picture Worlds' skill games: once a game's saved rounds are all won, it still starts and plays its rounds again, one after the other
// (1, 2, 3, 1...), and saves nothing new: no key, no bow, no light, no first-time reward, no gate moves. A rematch's harder play (you hold
// the star) and the kind help (kindhelp.js) work as before. A won Boss battle that clears a world's round keys simply makes the game
// count again (progress < rounds). Pure, no imports, Node-runnable.
export const FUN = { tag: 'Just for fun!' };

export class ForFun {
  constructor(rounds) { this.rounds = rounds; this.next = 0; }
  // All the saved rounds are won (`progress` = how many rounds are saved).
  done(progress) { return progress >= this.rounds; }
  // The round (0-based) to play next: the first one not won yet; once all are won, the next for-fun round in turn.
  round(progress) { return this.done(progress) ? this.next % this.rounds : progress; }
  // A round was won: for fun, the one after it comes next time (after the last, the first again).
  won(round, progress) { if (this.done(progress)) this.next = (round + 1) % this.rounds; }
  // Words for a for-fun round ('' while it still counts).
  tag(progress) { return this.done(progress) ? ` ${FUN.tag}` : ''; }
}
