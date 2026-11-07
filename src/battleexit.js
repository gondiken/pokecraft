// How you leave a battle before it is over (owner 2026-11-07: "Gym trainers and leaders, Boss helpers and Tower guards can be run too.
// Object orientation pls here."). Every battle gets ONE exit object when it starts (`exitFor(opts)`), and the battle only ever asks it:
// `button()` for the third button of the bottom row and `use(battle)` when that button is pressed. Nothing else in battle.js knows who
// you can run from. Pure apart from the battle it is handed (no imports), so Node can test the rules.
//   RunAway  every battle against the game (wild creatures, trainers, leaders, Bosses, their helpers, the Tower): the speed rule
//   GiveUp   a battle against another player (a duel or a co-op giant): both browsers must agree, so it is a message, not a dice roll
// A new kind of way out = a new subclass and one line in `exitFor`.

export class BattleExit {
  get label() { return ''; }
  get action() { return null; }
  // The bottom row's third button for `chooseAction`.
  button() { return { label: this.label, value: { kind: this.action } }; }
  // Pressed in a battle's own turn: -> a result that ends the battle ('ran'), or null = the battle goes on (the foe gets its turn).
  async use(battle) { return null; }
}

// The speed rule (the same since the first wild battles): 60 % at equal speed, 1 % more per point your creature is faster, 35 % .. 95 %.
export const RUN = { base: 0.6, perSpeed: 1 / 60, min: 0.35, max: 0.95 };
export class RunAway extends BattleExit {
  constructor(rule = RUN, random = Math.random) { super(); this.rule = rule; this.random = random; }
  get label() { return 'Run'; }
  get action() { return 'run'; }
  chance(allySpeed, foeSpeed) {
    const r = this.rule;
    return Math.max(r.min, Math.min(r.max, r.base + (allySpeed - foeSpeed) * r.perSpeed));
  }
  async use(battle) {
    const [mine, theirs] = battle.runSpeeds();
    if (this.random() < this.chance(mine, theirs)) { await battle.say('Got away safely!'); return 'ran'; }
    await battle.say("Couldn't get away!");
    return null;
  }
}

// Duels and co-op giants: the duel turn code sends the give-up message (battle.js duelTurn / coopTurn), so `use` is never asked.
export class GiveUp extends BattleExit {
  get label() { return 'Give up'; }
  get action() { return 'giveup'; }
}

export const exitFor = opts => (opts?.duel ? new GiveUp() : new RunAway());
