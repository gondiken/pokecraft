// The Echo Gym's dance-off: four coloured pads on the floor between the door and Leader Melody. She dances a few steps
// (the pads light up with a note each), you copy them by stepping on the pads, and every round adds a step. A wrong
// step just shows the round again (no fail). After the last round she battles you. The building is the old Echo Gym:
// the pads are drawn on its planks with setLive (this player only, never an edit), so no world block changes and badges,
// beaten trainers and rematch wins stay as they were. The only saved state is the key 'sound:danced' (game.keys): the
// dance is done and the battle is next (dropped when you beat her, so every rematch starts with a new dance). Outside a
// dance-off the pads still light up and play their note when you step on them.
import { B } from './blocks.js';
import { trainersOf, trainerKey } from './gyms.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';

export const DANCE = {
  d: [-2, -1], // the pads' rows (distance from the middle towards the door; Melody stands at -4, the trainer at 1)
  s: [[-5, -4], [-2, -1], [1, 2], [4, 5]], // each pad's two columns across the hall (the carpet at 0 stays)
  names: ['red', 'blue', 'green', 'yellow'],
  step: 0.75, // seconds per shown step
  lit: 0.5, // seconds a shown pad stays lit
  flash: 0.35, // seconds a pad you stepped on stays lit
  pause: 1.2, // seconds between rounds, after a mistake, and before the battle
  range: 9, // walking further than this from the middle stops the dance
};

// Steps per round: easy the first time; a rematch dance ends one step longer for every rematch win (up to 7).
export function danceRounds(game, def) {
  if (!game.badges.includes(def.id)) return [2, 3, 4];
  return [3, 4, Math.min(7, 5 + (game.rematchWins[def.id] || 0))];
}

// A new dance: no pad twice in a row (so you never have to step on the pad you are standing on).
export function danceSteps(n, rand = Math.random) {
  const out = [];
  while (out.length < n) {
    const k = Math.floor(rand() * 4);
    if (k !== out[out.length - 1]) out.push(k);
  }
  return out;
}

export class DanceLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.def = gym.def;
    this.cells = new LiveCells(game.world, () => game.player);
    this.now = () => performance.now() / 1000; // tests replace it
    const [fx, fz] = gym.front, col = (d, s) => [gym.x + fx * d + fz * s, gym.z + fz * d + fx * s];
    this.fy = gym.y - 1;
    this.pads = DANCE.s.map(ss => DANCE.d.flatMap(d => ss.map(s => col(d, s)))); // pad k -> its 4 [x, z] cells
    this.reset();
    this.draw();
  }

  get ui() { return this.game.ui; }
  has(k) { return this.game.keys.includes(`${this.def.id}:${k}`); }
  add(k) { if (!this.has(k)) this.game.keys.push(`${this.def.id}:${k}`); }
  drop(k) { const i = this.game.keys.indexOf(`${this.def.id}:${k}`); if (i >= 0) this.game.keys.splice(i, 1); }
  leader() { return this.game.npcs.list.find(n => n.gym === this.gym && n.kind === 'leader'); }
  beatTrainers() { return trainersOf(this.def).every((p, i) => this.game.beaten.includes(trainerKey(this.def, i))); }

  reset() {
    this.phase = 'idle'; // idle | show | play | cheer
    this.steps = [];
    this.rounds = [];
    this.round = 0;
    this.i = 0; // next step to copy
    this.at = 0; // when the current phase started
    this.flashes = [0, 0, 0, 0]; // until when each pad is lit by your step
    this.onPad = null;
    this.shown = -1;
  }

  // Which pad (0-3) is at this block, or null.
  padAt(x, y, z) {
    if (y !== this.fy) return null;
    const k = this.pads.findIndex(cells => cells.some(([a, b]) => a === x && b === z));
    return k < 0 ? null : k;
  }

  // The pad under the player's feet, or null (in the air counts as off, so a jump is a new step).
  padUnder() {
    const p = this.game.player;
    if (!p?.onGround) return null;
    return this.padAt(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z));
  }

  near() {
    const p = this.game.player?.pos;
    return !!p && Math.max(Math.abs(p.x - this.gym.x - 0.5), Math.abs(p.z - this.gym.z - 0.5)) <= DANCE.range && Math.abs(p.y - this.gym.y) < 4;
  }

  // Start (or restart) the dance-off.
  start() {
    this.reset();
    this.rounds = danceRounds(this.game, this.def);
    this.steps = danceSteps(this.rounds[this.rounds.length - 1]);
    this.show(0);
  }

  show(round) {
    this.round = round;
    this.phase = 'show';
    this.at = this.now();
    this.shown = -1;
    this.i = 0;
  }

  len() { return this.rounds[this.round]; }

  update() {
    this.cells.flush();
    const now = this.now(), ui = this.ui;
    if (this.phase !== 'idle' && !this.near()) {
      this.reset();
      ui?.toast(`${this.def.leader.name}: The dance-off stopped. Talk to me to dance again!`);
    }
    if (this.phase === 'show') {
      const k = Math.floor((now - this.at) / DANCE.step);
      if (k >= this.len()) {
        this.phase = 'play';
        this.at = now;
        ui?.toast(this.round === 0 ? 'Your turn! Step on the pads in the same order.' : 'Your turn!');
      } else if (k > this.shown) {
        this.shown = k;
        sound.play(`dancepad${this.steps[k]}`);
      }
    } else if (this.phase === 'play') {
      const k = this.padUnder();
      if (k !== null && k !== this.onPad) this.stepOn(k, now);
    } else if (this.phase === 'idle') { // free dancing: every pad you step on lights up and plays its note
      const k = this.padUnder();
      if (k !== null && k !== this.onPad) { this.flashes[k] = now + DANCE.flash; sound.play(`dancepad${k}`); }
    } else if (this.phase === 'cheer' && now - this.at >= DANCE.pause) {
      this.reset();
      this.battle();
    }
    if (this.phase !== 'show') this.onPad = this.padUnder();
    this.draw(now);
  }

  stepOn(k, now) {
    this.onPad = k;
    this.flashes[k] = now + DANCE.flash;
    sound.play(`dancepad${k}`);
    if (k !== this.steps[this.i]) {
      sound.play('danceoops');
      this.ui?.toast(`Oops! That was ${DANCE.names[k]}. Watch again!`);
      this.phase = 'show';
      this.shown = -1;
      this.i = 0;
      this.at = now + DANCE.pause; // a short pause, then the same round again
      return;
    }
    this.i++;
    if (this.i < this.len()) return;
    if (this.round + 1 < this.rounds.length) {
      this.ui?.toast(`Great! Round ${this.round + 2} of ${this.rounds.length}: one more step!`);
      this.show(this.round + 1);
      this.at = now + DANCE.pause;
      return;
    }
    this.add('danced');
    this.game.save?.();
    sound.play('danceyay');
    this.ui?.toast(`${this.def.leader.name}: What moves! Now let's see if your team can keep the beat!`);
    this.phase = 'cheer';
    this.at = now;
  }

  // Melody's battle: the badge battle, or a rematch.
  battle() {
    const game = this.game, def = this.def, npc = this.leader();
    if (!npc) return;
    if (!game.badges.includes(def.id)) game.startBattle({ trainer: npc, team: def.leaderTeam, intro: def.intro });
    else game.rematch.start(npc, ['Great dancing! Now a rematch.', 'My team has been practising too!']);
  }

  // Which pad shows lit right now.
  litPads(now) {
    const lit = this.flashes.map(t => now < t);
    if (this.phase === 'show') {
      const t = now - this.at, k = Math.floor(t / DANCE.step);
      if (t >= 0 && k < this.len() && t - k * DANCE.step < DANCE.lit) lit[this.steps[k]] = true;
    }
    if (this.phase === 'cheer') { const on = Math.floor((now - this.at) * 6) % 4; lit[on] = true; }
    return lit;
  }

  draw(now = this.now()) {
    const lit = this.litPads(now);
    this.pads.forEach((cells, k) => {
      const id = B[lit[k] ? `DANCE_${k}_LIT` : `DANCE_${k}`];
      for (const [x, z] of cells) this.cells.want(x, this.fy, z, id);
    });
  }

  talk(npc) {
    if (npc.gym !== this.gym || npc.kind !== 'leader' || !this.beatTrainers()) return false;
    const name = this.def.leader.name, ui = this.ui;
    if (this.has('danced')) { this.battle(); return true; }
    if (this.phase === 'idle') {
      ui.toast(`${name}: Dance-off! Watch the pads light up, then step on them in the same order.`);
      this.start();
    } else if (this.phase === 'show') ui.toast(`${name}: Watch my steps!`);
    else if (this.phase === 'play') ui.toast(`${name}: Your turn! Step on the pads.`);
    return true;
  }

  talkPrompt(npc) {
    if (npc.gym !== this.gym || npc.kind !== 'leader' || !this.beatTrainers()) return null;
    if (this.has('danced')) return { verb: this.game.badges.includes(this.def.id) ? 'ask for a rematch' : 'battle', action: 'Battle!' };
    if (this.phase === 'idle') return { verb: 'dance', action: 'Dance-off!' };
    return { verb: 'talk', action: 'Talk' };
  }

  // Melody lost: the next battle starts with a new dance.
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.trainer?.kind !== 'leader' || opts.trainer.gym !== this.gym) return;
    this.drop('danced');
    this.reset();
  }

  state() { return { phase: this.phase, steps: this.steps.slice(), rounds: this.rounds.slice(), round: this.round, i: this.i, danced: this.has('danced') }; }
}
