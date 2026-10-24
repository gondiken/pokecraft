// Battles between players in the same world. One player challenges, the other says yes or no.
// Each side battles with full-HP copies of both teams, so nobody's real team is hurt, and the
// winner gets Capture Cubes. Both browsers work out every turn themselves: they swap only the
// chosen actions and share a random seed, so they always agree on what happened.
import { sound } from './sound.js';
import { cleanTraits } from './traits.js';
import { cleanCoop, bossName, COOP_RANGE } from './coopboss.js'; // T29

const ANSWER_TIME = 30; // seconds to answer a challenge
const WAIT_TIME = 90; // seconds without an answer in a battle before we treat the other player as gone
export const VERSION = 11; // 11: T38c giants grow (coop.grow). 8: wave 9 (T24 multi-hit 1-5 + sleep turns; T25 adds to this without another bump). 9: T29 co-op boss battles (the coop field). 10: T34 crews (weakensWithHp: attack shrinks with HP, multi-hit x1.2 against them)

const newId = () => Math.random().toString(36).slice(2, 10);
const teamOf = party => party.map(c => ({ species: c.species, level: c.level, moves: [...c.moves], traits: [...(c.traits || [])] }));
const teamIn = team => (Array.isArray(team) ? team : []).map(c => ({ ...c, traits: cleanTraits(c?.traits, c?.species) }));

export class Duels {
  // hooks: { start(duel), toast(text) }
  constructor(game, hooks) {
    this.game = game;
    this.hooks = hooks;
    this.asking = null;   // { id, to, name, timer } while waiting for an answer
    this.incoming = null; // { id, from, name, team, seed, timer } while deciding
    this.current = null;  // the battle being played
    this.waitTime = WAIT_TIME; // tests make this shorter
    this.box = document.getElementById('duel-ask');
    document.getElementById('duel-yes').addEventListener('click', e => { e.stopPropagation(); this.accept(); });
    document.getElementById('duel-no').addEventListener('click', e => { e.stopPropagation(); this.decline(); });
  }

  get mp() { return this.game.mp; }

  // coop (T29) = coopFor(...) result: ask a friend to help with a giant (2 against 1) instead of a battle
  challenge(avatar, coop = null) {
    const g = this.game;
    if (this.asking) { this.hooks.toast(`Still waiting for ${this.asking.name} to answer.`); return; }
    if (g.hideSeek?.active) { this.hooks.toast('Finish hide and seek first!'); return; } // T30
    if (this.incoming || this.current || g.inBattle) return;
    if (!g.party.length) return;
    const id = newId();
    const seed = (Math.random() * 2 ** 31) | 0;
    this.asking = {
      id, seed, to: avatar.id, name: avatar.name, coop,
      timer: setTimeout(() => {
        this.mp.sendDuel(avatar.id, { type: 'cancel', id });
        this.asking = null;
        this.hooks.toast(`${avatar.name} didn't answer. Try again later!`);
      }, ANSWER_TIME * 1000),
    };
    this.mp.sendDuel(avatar.id, { type: 'ask', v: VERSION, id, seed, team: teamOf(g.party), coop: coop && { mission: coop.mission, boss: coop.boss, at: coop.at, grow: coop.grow | 0 } }); // T38c: grow
    this.hooks.toast(coop ? `You asked ${avatar.name} to help with the giant. Waiting for an answer...` : `You asked ${avatar.name} for a battle. Waiting for an answer...`);
  }

  onMessage(p) {
    const g = this.game;
    if (p.type === 'ask') {
      if (p.v !== VERSION) { this.mp.sendDuel(p.from, { type: 'no', id: p.id, old: true }); return; } // the asker has an older game
      if (!g.started || g.inBattle || g.hideSeek?.active || this.current || this.incoming || this.asking || !g.party.length) {
        this.mp.sendDuel(p.from, { type: 'no', id: p.id, busy: true });
        return;
      }
      const coop = p.coop ? cleanCoop(p.coop) : null; // T29
      if (p.coop) {
        const far = this.mp.others.get(p.from)?.pos.distanceTo(g.player.pos) > COOP_RANGE + 8;
        if (!coop || far || !teamIn(p.team).length) { this.mp.sendDuel(p.from, { type: 'no', id: p.id, busy: true }); return; }
      }
      this.incoming = { id: p.id, from: p.from, name: p.name, team: teamIn(p.team), seed: p.seed, coop,
        timer: setTimeout(() => this.decline(), ANSWER_TIME * 1000) };
      document.getElementById('duel-text').textContent = coop
        ? `${p.name} needs your help! A ${bossName(coop.boss)} is here. Battle it together, 2 against 1?`
        : `${p.name} wants to have a creature battle with you!`;
      this.box.classList.remove('hidden');
      sound.play('ask');
    } else if (p.type === 'cancel' && this.incoming?.id === p.id) {
      this.closeAsk();
    } else if (p.type === 'no' && this.asking?.id === p.id) {
      clearTimeout(this.asking.timer);
      const coop = this.asking.coop;
      this.asking = null;
      this.hooks.toast(coop ? `${p.name} can't help right now.` : p.busy ? `${p.name} is busy right now. Try again soon!` : `${p.name} doesn't want to battle right now.`);
    } else if (p.type === 'yes' && this.asking?.id === p.id) {
      const a = this.asking;
      clearTimeout(a.timer);
      this.asking = null;
      if (p.v !== VERSION) { // the other game is older: the moves would not match, so don't start
        this.mp.sendDuel(p.from, { type: 'act', id: p.id, n: 0, action: { kind: 'left' } });
        this.hooks.toast(`${p.name} needs to reload the game to battle (it was updated).`);
        return;
      }
      if (g.inBattle) { this.mp.sendDuel(p.from, { type: 'act', id: p.id, n: 0, action: { kind: 'left' } }); return; }
      this.begin({ id: a.id, seed: a.seed, opp: p.from, name: p.name, team: teamIn(p.team), first: true, coop: a.coop && { ...a.coop, helper: false } });
    } else if (p.type === 'act' && this.current?.id === p.id) {
      const d = this.current;
      d.inbox[p.n] = p.action;
      d.wake?.();
    }
  }

  accept() {
    const inc = this.incoming;
    if (!inc) return;
    this.closeAsk();
    if (!this.mp.others.has(inc.from)) return;
    if (this.game.inBattle) { this.mp.sendDuel(inc.from, { type: 'no', id: inc.id, busy: true }); return; }
    this.mp.sendDuel(inc.from, { type: 'yes', v: VERSION, id: inc.id, team: teamOf(this.game.party) });
    this.begin({ id: inc.id, seed: inc.seed, opp: inc.from, name: inc.name, team: inc.team, first: false, coop: inc.coop && { ...inc.coop, helper: true } });
  }

  decline() {
    const inc = this.incoming;
    if (!inc) return;
    this.closeAsk();
    this.mp.sendDuel(inc.from, { type: 'no', id: inc.id });
  }

  closeAsk() {
    if (this.incoming) clearTimeout(this.incoming.timer);
    this.incoming = null;
    this.box.classList.add('hidden');
  }

  begin(info) {
    const avatar = this.mp.others.get(info.opp);
    if (!avatar) return;
    const d = this.current = {
      ...info, avatar, pos: avatar.pos.clone(), sent: 0, got: 0, inbox: [], wake: null,
      send: action => this.mp.sendDuel(info.opp, { type: 'act', id: info.id, n: d.sent++, action }),
      // The other player's next action, in order. { kind: 'left' } if they leave the world, and
      // { kind: 'left', quiet: true } if they don't answer for waitTime seconds (we tell them too).
      next: () => new Promise(resolve => {
        const since = performance.now();
        const done = value => { d.wake = null; d.stop = null; clearInterval(timer); resolve(value); };
        const check = () => {
          if (d.inbox[d.got] !== undefined) { done(d.inbox[d.got++]); return; }
          if (!this.mp.others.has(info.opp)) { done({ kind: 'left' }); return; }
          if (performance.now() - since > this.waitTime * 1000) {
            d.send({ kind: 'left' });
            done({ kind: 'left', quiet: true });
          }
        };
        const timer = setInterval(check, 500);
        d.wake = check;
        // Stop waiting (we gave up): the promise is simply never resolved.
        d.stop = () => { d.wake = null; d.stop = null; clearInterval(timer); };
        check();
      }),
    };
    avatar.dueling = true;
    this.hooks.start(d);
  }

  finish() {
    this.current?.stop?.();
    if (this.current?.avatar) this.current.avatar.dueling = false;
    this.current = null;
  }

  // Any other battle is starting: say "busy" to an invite and stop asking someone.
  busy() {
    const inc = this.incoming;
    if (inc) { this.closeAsk(); this.mp.sendDuel(inc.from, { type: 'no', id: inc.id, busy: true }); }
    const a = this.asking;
    if (a) { clearTimeout(a.timer); this.asking = null; this.mp.sendDuel(a.to, { type: 'cancel', id: a.id }); }
  }

  // Back to the title screen or leaving play-together: stop every timer and close the invite box.
  reset() {
    if (this.asking) clearTimeout(this.asking.timer);
    this.asking = null;
    this.closeAsk();
    this.finish();
  }

  // The other player left the world.
  left(id) {
    if (this.incoming?.from === id) this.closeAsk();
    if (this.asking?.to === id) { clearTimeout(this.asking.timer); this.asking = null; }
    this.current?.wake?.();
  }
}
