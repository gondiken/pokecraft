// Turn-based battles that play out in the 3D world with an HTML overlay.
import * as THREE from 'three';
import {
  SPECIES, MOVES, TYPE_COLORS, effectiveness, statsFor, nameOf, gainXp,
  xpForLevel, buildModel, tintModel, disposeModel, makeCreature, moveInfo,
} from './species.js';
import { B, isSolid, mulberry32 } from './blocks.js';
import { wait, tween, easeOut, hpColor, el } from './util.js';
import { sound } from './sound.js';

const PARTY_MAX = 6;

// Stat changes: +1 / -1 per use, at most 3 either way. Gentle: +3 is x1.75, -3 is x0.57.
const stage = s => (s >= 0 ? (4 + s) / 4 : 4 / (4 - s));
const STAT_NAMES = { atk: 'attack', def: 'defence', spd: 'speed' };

export class Battle {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('battle');
    this.log = document.getElementById('b-log');
    this.actions = document.getElementById('b-actions');
    this.wildCard = document.getElementById('b-wild');
    this.allyCard = document.getElementById('b-ally');
    this.skip = null;
    this.history = [];
    this.modMap = new Map();
    this.log.addEventListener('click', () => this.skip?.());
    this.allyModel = null;
    this.active = false;
  }

  get ally() { return this.allies[this.allyIdx]; }
  get foe() { return this.foes[this.foeIdx]; }
  get foeLabel() { return this.duel ? `${this.duel.name}'s` : this.trainer ? 'Foe' : 'Wild'; }

  // Standing height at (x, z), searching down from fromY so creatures stay inside buildings.
  groundBelow(x, z, fromY) {
    const world = this.game.world;
    const xi = Math.floor(x), zi = Math.floor(z);
    for (let y = Math.floor(fromY) + 1; y >= 0; y--) {
      const id = world.get(xi, y, zi);
      if (id === B.WATER) return y + 0.55;
      if (isSolid(id)) return y + 1;
    }
    return fromY;
  }

  cry(c) { sound.cry(c.species, SPECIES[c.species].type); }

  // Changes in a creature during one battle (stat steps, sleep). Never saved; cleared when it comes in.
  mods(c) {
    let m = this.modMap.get(c);
    if (!m) this.modMap.set(c, m = { atk: 0, def: 0, spd: 0, sleep: false, flinch: false, healed: 0 });
    return m;
  }

  speedOf(c) { return Math.floor(statsFor(c).spd * stage(this.mods(c).spd)); }

  say(text, ms = 1300) {
    this.log.textContent = text;
    this.history.push(text);
    if (this.history.length > 60) this.history.shift();
    return new Promise(resolve => {
      const timer = setTimeout(done, ms);
      function done() { clearTimeout(timer); resolve(); }
      this.skip = done;
    });
  }

  card(target, c, showNumbers) {
    const st = statsFor(c);
    const frac = c.hp / st.maxHp;
    const sp = SPECIES[c.species];
    const xpFrac = (c.xp - xpForLevel(c.level)) / (xpForLevel(c.level + 1) - xpForLevel(c.level));
    target.replaceChildren(...[
      el('div', { class: 'top' },
        el('span', { class: 'nm' }, sp.name),
        el('span', {}, el('span', { class: 'type', style: `background:${TYPE_COLORS[sp.type]}` }, sp.type), ` Lv${c.level}`)),
      el('div', { class: 'hpbar' }, el('div', { style: `width:${frac * 100}%;background:${hpColor(frac)}` })),
      showNumbers && el('div', { class: 'hpnum' }, `${c.hp} / ${st.maxHp}`),
      showNumbers && el('div', { class: 'xpbar' }, el('div', { style: `width:${Math.max(0, Math.min(1, xpFrac)) * 100}%` })),
      this.tagsFor(c),
    ].filter(Boolean));
  }

  // Little tags under the HP bar: ATK ↑2, DEF ↓, SPD ↑, Zzz.
  tagsFor(c) {
    const m = this.mods(c);
    const tags = [];
    for (const [k, label] of [['atk', 'ATK'], ['def', 'DEF'], ['spd', 'SPD']]) {
      if (m[k]) tags.push(el('span', { class: m[k] > 0 ? 'up' : 'down' }, `${label} ${m[k] > 0 ? '↑' : '↓'}${Math.abs(m[k]) > 1 ? Math.abs(m[k]) : ''}`));
    }
    if (m.sleep) tags.push(el('span', { class: 'zzz' }, 'Zzz'));
    return tags.length ? el('div', { class: 'b-tags' }, ...tags) : null;
  }

  refresh() {
    this.game.book?.markSeen(this.foe.species);
    this.card(this.wildCard, this.foe, false);
    this.card(this.allyCard, this.ally, true);
  }

  choose(buttons) {
    return new Promise(resolve => {
      this.actions.replaceChildren(...buttons.map(b => {
        if (b.row) return el('div', { class: 'row3' }, ...b.row.map(r => this.button(r, resolve)));
        if (b.info) return el('div', { class: 'b-info wide' }, ...b.info);
        return this.button(b, resolve);
      }));
    });
  }

  button(b, resolve) {
    return el('button', {
      class: b.cls || '', style: b.style || '', disabled: !!b.disabled,
      onclick: () => { this.actions.replaceChildren(); resolve(b.value); },
    }, b.label, b.sub && el('small', {}, b.sub));
  }

  async chooseAction() {
    for (;;) {
      const g = this.game;
      const moves = this.ally.moves.map(id => {
        const mv = MOVES[id];
        return {
          label: mv.name, sub: `${mv.type} · ${moveInfo(id).text}`, value: { kind: 'move', move: id },
          style: `background:${TYPE_COLORS[mv.type]};color:#111`,
        };
      });
      const canSwitch = this.allies.some((c, i) => i !== this.allyIdx && c.hp > 0);
      const trainer = !!this.trainer;
      const duel = !!this.duel;
      const choice = await this.choose([
        ...moves,
        { row: [
          { label: trainer ? 'Cube' : `Cube x${g.cubes}`, value: { kind: 'catch' }, disabled: trainer || g.cubes <= 0, cls: 'primary' },
          { label: 'Switch', value: { kind: 'switch' }, disabled: !canSwitch },
          duel ? { label: 'Give up', value: { kind: 'giveup' } } : { label: 'Run', value: { kind: 'run' }, disabled: trainer },
        ] },
      ]);
      if (choice.kind !== 'switch') return choice;
      const idx = await this.pickPartyMember(true);
      if (idx !== null) return { kind: 'switch', idx };
    }
  }

  async pickPartyMember(allowBack) {
    this.log.textContent = 'Choose a creature.';
    const opts = this.allies.map((c, i) => ({
      label: `${nameOf(c)} Lv${c.level}`, sub: `HP ${c.hp}/${statsFor(c).maxHp}`,
      value: i, disabled: c.hp <= 0 || i === this.allyIdx,
    }));
    if (allowBack) opts.push({ label: 'Back', value: null, cls: 'wide' });
    return this.choose(opts);
  }

  /* ------------------------------ 3D staging ------------------------------ */

  placeAlly(keepMods = false) {
    const g = this.game;
    if (!keepMods) this.modMap.delete(this.ally); // a creature coming in starts fresh
    if (this.allyModel) { g.scene.remove(this.allyModel); disposeModel(this.allyModel); }
    const p = g.player.pos;
    const w = this.foePos;
    const dir = new THREE.Vector3(w.x - p.x, 0, w.z - p.z);
    const gap = dir.length();
    dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const pos = p.clone().addScaledVector(dir, Math.min(2.6, gap * 0.45)).addScaledVector(right, 1.5);
    pos.y = this.groundBelow(pos.x, pos.z, p.y + 1);
    const model = buildModel(this.ally.species);
    model.position.copy(pos);
    model.rotation.y = Math.atan2(w.x - pos.x, w.z - pos.z);
    g.scene.add(model);
    this.allyModel = model;
    this.allyHome = pos.clone();
    return tween(300, t => model.scale.setScalar(easeOut(t)));
  }

  // Back the player away so both creatures fit on screen.
  stepBack(from, want = 5) {
    const p = this.game.player;
    const dir = new THREE.Vector3(p.pos.x - from.x, 0, p.pos.z - from.z);
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize();
    for (let i = 0; i < 40 && Math.hypot(p.pos.x - from.x, p.pos.z - from.z) < want; i++) {
      const next = p.pos.clone().addScaledVector(dir, 0.1);
      if (p.collides(next)) break;
      p.pos.copy(next);
    }
  }

  modelOf(side) { return side === 'ally' ? this.allyModel : this.foeModel; }

  // Where a creature is, for the attack animations (null when it has no model on screen).
  spot(side) {
    const m = this.modelOf(side);
    if (!m || !m.parent || !m.visible) return null;
    const box = new THREE.Box3().setFromObject(m);
    if (box.isEmpty()) return null;
    const pos = box.getCenter(new THREE.Vector3());
    return { pos, top: box.max.y, r: Math.max(0.3, (box.max.x - box.min.x) / 2) };
  }

  // Trainer battles: put the trainer's current creature between them and the player.
  async sendOutFoe() {
    const g = this.game;
    const npc = this.trainer;
    this.modMap.delete(this.foe);
    if (this.foeModel) { g.scene.remove(this.foeModel); disposeModel(this.foeModel); }
    const p = g.player.pos;
    const dir = new THREE.Vector3(p.x - npc.pos.x, 0, p.z - npc.pos.z);
    const dist = dir.length();
    dir.normalize();
    const pos = npc.pos.clone().addScaledVector(dir, Math.min(2.2, dist * 0.4));
    pos.y = this.groundBelow(pos.x, pos.z, npc.pos.y + 0.5);
    const model = buildModel(this.foe.species);
    model.position.copy(pos);
    model.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
    model.scale.setScalar(0.01);
    g.scene.add(model);
    this.foeModel = model;
    this.foePos = pos;
    this.refresh();
    this.say(`${npc.name} sent out ${nameOf(this.foe)}!`, 1200);
    this.cry(this.foe);
    await tween(300, t => model.scale.setScalar(easeOut(t)));
    await wait(900);
  }

  async lunge(side) {
    const a = this.modelOf(side), b = this.modelOf(side === 'ally' ? 'foe' : 'ally');
    const start = a.position.clone();
    const toward = b.position.clone().sub(start).setY(0).normalize().multiplyScalar(0.8);
    await tween(320, t => {
      const k = Math.sin(t * Math.PI);
      a.position.set(start.x + toward.x * k, start.y + k * 0.25, start.z + toward.z * k);
    });
    a.position.copy(start);
  }

  async flash(side) {
    const m = this.modelOf(side);
    for (let i = 0; i < 3; i++) {
      tintModel(m, 0xff2222); await wait(70);
      tintModel(m, null); await wait(70);
    }
  }

  /* ------------------------------ battle flow ------------------------------ */

  // opts is { wild } for a wild creature, { trainer, team, intro } for a trainer battle, or
  // { duel } for a battle with another player (see duel.js).
  async start(opts) {
    const g = this.game;
    g.fx?.clear();
    this.active = true;
    this.wild = opts.wild || null;
    this.duel = opts.duel || null;
    // In a battle between players both sides use the same random numbers, so they agree on every turn.
    this.rng = this.duel ? mulberry32(this.duel.seed) : Math.random;
    this.boss = !!opts.boss;
    this.poweredUp = false;
    this.modMap = new Map();
    this.history = [];
    this.xpBoost = opts.xpBoost || 1;
    this.trainer = opts.trainer || (this.duel && { name: this.duel.name, pos: this.duel.pos });
    this.foeModel = null;
    this.foeIdx = 0;
    // Battles between players use full-HP copies of each team, so nobody's real team gets hurt.
    const copy = c => makeCreature(c.species, Math.max(1, Math.min(60, c.level | 0)), c.moves);
    this.allies = this.duel ? g.party.map(copy) : g.party;
    this.allyIdx = this.allies.findIndex(c => c.hp > 0);
    this.root.classList.remove('hidden');
    this.actions.replaceChildren();
    sound.play(this.boss ? 'boss' : 'battle');
    if (this.boss) this.music = setInterval(() => sound.play('bossloop'), 6400);

    if (this.wild) {
      const wild = this.wild;
      this.foes = [wild.data];
      wild.frozen = true;
      wild.face(g.player.pos);
      this.foeModel = wild.model;
      this.foePos = wild.pos;
      this.stepBack(wild.pos, 4.5);
      g.player.lookAt(new THREE.Vector3(wild.pos.x, wild.pos.y + 0.5, wild.pos.z));
      this.refresh();
      this.cry(this.foe);
      await this.say(`A wild ${nameOf(this.foe)} appeared!`);
    } else {
      const npc = this.trainer;
      this.foes = this.duel ? this.duel.team.filter(c => SPECIES[c?.species]).slice(0, 6).map(copy) : opts.team.map(([species, level]) => makeCreature(species, level));
      this.stepBack(npc.pos, 5.5);
      g.player.lookAt(new THREE.Vector3(npc.pos.x, npc.pos.y + 1.2, npc.pos.z));
      this.foePos = npc.pos;
      this.refresh();
      for (const line of opts.intro || []) await this.say(`${npc.name}: ${line}`, 2400);
      await this.say(this.duel ? `Battle with ${npc.name}! (${this.foes.length} creatures)` : `${npc.name} wants to battle! (${this.foes.length} creatures)`, 1600);
      await this.sendOutFoe();
    }
    await this.placeAlly();
    this.cry(this.ally);
    await this.say(`Go, ${nameOf(this.ally)}!`, 900);

    let result = null;
    while (!result) result = await this.turn();
    g.fx?.clear();
    clearInterval(this.music);
    this.music = null;

    // With a mouse, the browser only gives the mouse back to the game after a click, so end on a
    // button instead of making the player click through a pause screen.
    // Enter, Space or E press it too (main.js), which also lets the game take the mouse back.
    if (!g.isTouch()) {
      await this.choose([{ label: 'Continue exploring', sub: this.endText(result), value: true, cls: 'wide primary continue' }]);
    }

    this.root.classList.add('hidden');
    if (this.allyModel) {
      const m = this.allyModel;
      await tween(250, t => m.scale.setScalar(1 - t));
      g.scene.remove(m); disposeModel(m);
      this.allyModel = null;
    }
    if (this.wild) {
      if (result === 'caught' || result === 'won') g.creatures.remove(this.wild);
      else this.wild.frozen = false;
    } else if (this.foeModel) {
      g.scene.remove(this.foeModel); disposeModel(this.foeModel);
    }
    this.foeModel = null;
    this.active = false;
    g.onBattleEnd(result, opts);
  }

  // A few words on the "Continue exploring" button about how the battle ended.
  endText(result) {
    if (result === 'caught') return `You caught ${nameOf(this.foe)}!`;
    if (result === 'won') return this.trainer ? `You beat ${this.trainer.name}!` : 'You won!';
    if (result === 'ran') return 'You got away.';
    if (result === 'lost') return this.duel ? `${this.duel.name} won this time.` : 'Your team is resting at the start.';
    if (result === 'gaveup') return 'You gave up.';
    return '';
  }

  async turn() {
    if (this.duel) return this.duelTurn();
    const action = await this.chooseAction();
    const g = this.game;

    if (action.kind === 'run') {
      const diff = statsFor(this.ally).spd - statsFor(this.foe).spd;
      const chance = Math.max(0.35, Math.min(0.95, 0.6 + diff / 60));
      if (Math.random() < chance) { await this.say('Got away safely!'); return 'ran'; }
      await this.say("Couldn't get away!");
      return this.foeTurn();
    }

    if (action.kind === 'catch') {
      g.cubes--;
      g.ui.renderHud();
      if (await this.throwCube()) return 'caught';
      return this.foeTurn();
    }

    if (action.kind === 'switch') {
      await this.say(`Come back, ${nameOf(this.ally)}!`, 800);
      this.allyIdx = action.idx;
      this.refresh();
      await this.placeAlly();
      this.cry(this.ally);
    await this.say(`Go, ${nameOf(this.ally)}!`, 900);
      return this.foeTurn();
    }

    // Both sides attack; priority moves first, then the faster creature.
    const foeMove = this.pickFoeMove();
    const allyFirst = (MOVES[action.move].priority || 0) - (MOVES[foeMove].priority || 0) ||
      this.speedOf(this.ally) - this.speedOf(this.foe) || Math.random() - 0.5;
    const order = allyFirst > 0
      ? [['ally', action.move], ['foe', foeMove]]
      : [['foe', foeMove], ['ally', action.move]];
    this.clearFlinch();
    for (const [i, [side, move]] of order.entries()) {
      await this.useMove(side, move, { first: i === 0 });
      if (this.foe.hp <= 0) return this.foeFainted();
      if (this.ally.hp <= 0) return this.allyFainted();
    }
    this.clearFlinch();
    return null;
  }

  // Waits for the other player's next action, with a "Give up" button in case they stop answering.
  // Returns their action, or { kind: 'me-giveup' } if we gave up while waiting.
  async waitForThem(text) {
    const d = this.duel;
    this.log.textContent = text;
    const quit = this.choose([{ label: 'Give up', value: { kind: 'me-giveup' }, cls: 'wide' }]);
    const action = await Promise.race([d.next(), quit]);
    if (action.kind === 'me-giveup') { d.stop?.(); d.send({ kind: 'giveup' }); }
    else this.actions.replaceChildren();
    return action;
  }

  leftText(action) {
    const name = this.duel.name;
    return action.quiet ? `${name} stopped answering, so the battle is over.` : `${name} had to go, so the battle is over.`;
  }

  // A turn against another player: both choose, swap choices, then both play out the same turn.
  async duelTurn() {
    const d = this.duel;
    const mine = await this.chooseAction();
    d.send(mine);
    if (mine.kind === 'giveup') { await this.say('You gave up. Good try!'); return 'gaveup'; }
    const theirs = await this.waitForThem(`Waiting for ${d.name}...`);
    if (theirs.kind === 'me-giveup') { await this.say('You gave up. Good try!'); return 'gaveup'; }
    if (theirs.kind === 'left') { await this.say(this.leftText(theirs)); return 'ended'; }
    if (theirs.kind === 'giveup') { await this.say(`${d.name} gave up! You win!`); return 'won'; }

    // Switching happens before anyone attacks.
    if (mine.kind === 'switch') {
      await this.say(`Come back, ${nameOf(this.ally)}!`, 800);
      this.allyIdx = mine.idx;
      this.refresh();
      await this.placeAlly();
      this.cry(this.ally);
    await this.say(`Go, ${nameOf(this.ally)}!`, 900);
    }
    if (theirs.kind === 'switch') {
      this.foeIdx = this.foeIndex(theirs.idx);
      await this.sendOutFoe();
    }
    const attacks = [];
    if (mine.kind === 'move') attacks.push(['ally', mine.move]);
    if (theirs.kind === 'move') {
      if (!MOVES[theirs.move]) theirs.move = 'tackle'; // from a different game version
      attacks.push(['foe', theirs.move]);
    }
    if (attacks.length === 2) {
      // Priority moves first, then the faster creature. A tie is broken by the shared random
      // numbers, seen from the challenger's side so both players get the same answer.
      const diff = (MOVES[mine.move].priority || 0) - (MOVES[theirs.move].priority || 0) ||
        this.speedOf(this.ally) - this.speedOf(this.foe);
      const challengerFirst = diff === 0 ? this.rng() < 0.5 : null;
      const meFirst = diff !== 0 ? diff > 0 : challengerFirst === d.first;
      if (!meFirst) attacks.reverse();
    }
    this.clearFlinch();
    for (const [i, [side, move]] of attacks.entries()) {
      await this.useMove(side, move, { first: i === 0 && attacks.length === 2 });
      if (this.foe.hp <= 0) return this.foeFainted();
      if (this.ally.hp <= 0) return this.allyFainted();
    }
    this.clearFlinch();
    return null;
  }

  clearFlinch() {
    this.mods(this.ally).flinch = false;
    this.mods(this.foe).flinch = false;
  }

  // The other player's choice of creature, or their first healthy one if it doesn't make sense.
  foeIndex(idx) {
    return this.foes[idx]?.hp > 0 ? idx : this.foes.findIndex(c => c.hp > 0);
  }

  async foeTurn() {
    await this.useMove('foe', this.pickFoeMove());
    return this.ally.hp <= 0 ? this.allyFainted() : null;
  }

  // Wild and trainer creatures mostly pick a good attack, sometimes something else. (Not used in
  // player battles, so plain Math.random is fine here.)
  pickFoeMove() {
    const foe = this.foe, ally = this.ally;
    const fm = this.mods(foe), am = this.mods(ally);
    const allyType = SPECIES[ally.species].type, foeType = SPECIES[foe.species].type;
    const score = id => {
      const mv = MOVES[id];
      if (mv.power > 0) {
        const eff = effectiveness(mv.type, allyType);
        if (eff === 0) return 0;
        const stab = mv.type === foeType ? 1.5 : 1;
        return mv.power * eff * stab * (mv.sure ? 1 : mv.acc) * (mv.fx?.kind === 'multi' ? 3 : 1);
      }
      const fx = mv.fx;
      if (fx.kind === 'heal') return foe.hp < statsFor(foe).maxHp * 0.45 && fm.healed < 1 ? 120 : 0;
      if (fx.kind === 'raise') return fm[fx.stat] < 2 && foe.hp > statsFor(foe).maxHp * 0.6 ? 45 : 0;
      if (fx.kind === 'lower') return am[fx.stat] > -2 ? 40 : 0;
      if (fx.kind === 'sleep') return am.sleep ? 0 : 55;
      return 0;
    };
    const scored = foe.moves.map(id => [id, score(id)]);
    if (Math.random() < 0.5) {
      const best = Math.max(...scored.map(s => s[1]));
      const top = scored.filter(s => s[1] === best);
      return top[Math.floor(Math.random() * top.length)][0];
    }
    const ok = scored.filter(s => s[1] > 0);
    const pool = ok.length ? ok : scored;
    return pool[Math.floor(Math.random() * pool.length)][0];
  }

  // One creature uses a move. The random numbers are drawn in a fixed order (hit, number of hits,
  // critical, damage roll, effect chance) and never depend on which side is moving, because in a
  // player battle both browsers must draw exactly the same numbers.
  async useMove(side, moveId, { first = false } = {}) {
    const atk = side === 'ally' ? this.ally : this.foe;
    const def = side === 'ally' ? this.foe : this.ally;
    const mv = MOVES[moveId];
    const who = this.labelOf(side);
    const ma = this.mods(atk), md = this.mods(def);
    const fx = this.game.fx; // attack animations (never draw random numbers, never block)
    // A flinched or sleepy creature loses its move.
    if (ma.flinch) {
      ma.flinch = false;
      fx?.status('flinch', this.spot(side));
      await this.say(`${who} flinched and couldn't move!`, 1100);
      return;
    }
    if (ma.sleep) {
      sound.play('snooze');
      fx?.status('sleep', this.spot(side));
      await this.say(`${who} is fast asleep... Zzz`, 1100);
      ma.sleep = false;
      this.refresh();
      await this.say(`${who} woke up!`, 900);
      return;
    }
    this.say(`${who} used ${mv.name}!`, 700);
    sound.play(sound.has(moveId) ? moveId : `fx:${mv.type}`); // sound-type moves have their own sound
    await this.lunge(side);
    await wait(150);
    const hit = this.rng(); // draw 1: always, even for moves that never miss
    if (!mv.sure && hit > mv.acc) { sound.play('miss'); fx?.status('miss', this.spot(side === 'ally' ? 'foe' : 'ally'), { from: this.spot(side) }); await this.say('But it missed!', 1000); return; }
    if (!mv.power) { fx?.aura(mv.type, this.spot(side)); await this.applyFx(side, mv, { first }); return; }

    const mfx = mv.fx;
    let hits = 1;
    if (mfx?.kind === 'multi') hits = mfx.min + Math.floor(this.rng() * (mfx.max - mfx.min + 1)); // draw 2
    const as = statsFor(atk), ds = statsFor(def);
    const eff = effectiveness(mv.type, SPECIES[def.species].type);
    const stab = mv.type === SPECIES[atk.species].type ? 1.5 : 1;
    const crit = this.rng() < 1 / 16 ? 1.5 : 1;
    const atkPower = as.atk * stage(ma.atk) * (atk.boost || 1), defPower = ds.def * stage(md.def);
    const base = Math.floor((((2 * atk.level) / 5 + 2) * mv.power * atkPower / defPower) / 50) + 2;
    const dmg = Math.max(1, Math.floor(base * stab * eff * crit * (0.85 + this.rng() * 0.15)));
    const hpStart = def.hp;
    // The champion's last creature hangs on once and powers up at half HP.
    const bossLast = this.boss && side === 'ally' && this.foeIdx === this.foes.length - 1 && !this.poweredUp;
    let done = 0;
    await fx?.attack(moveId, this.spot(side), this.spot(side === 'ally' ? 'foe' : 'ally'));
    for (let i = 0; i < hits && def.hp > 0; i++) {
      const hpBefore = def.hp;
      def.hp = Math.max(0, def.hp - dmg);
      if (bossLast && def.hp <= 0 && hpBefore > statsFor(def).maxHp / 2) def.hp = 1;
      done++;
      sound.play(eff > 1 ? 'super' : 'hit');
      this.flash(side === 'ally' ? 'foe' : 'ally');
      fx?.impact(mv.type, this.spot(side === 'ally' ? 'foe' : 'ally'), { big: !!mv.sig });
      this.refresh();
      await wait(hits > 1 ? 300 : 450);
    }
    const dealt = hpStart - def.hp;
    if (crit > 1) await this.say('A critical hit!', 900);
    if (eff === 0) await this.say(`It doesn't affect ${nameOf(def)}...`, 1100);
    else if (eff > 1) await this.say("It's super effective!", 1000);
    else if (eff < 1) await this.say("It's not very effective...", 1000);
    if (hits > 1 && eff > 0) await this.say(`Hit ${done} times!`, 900);

    // draw 5: only moves with a "chance" effect, and always drawn so both players stay in step
    if (mfx?.chance) {
      const roll = this.rng();
      if (roll < mfx.chance && eff > 0 && (mfx.kind === 'raise' || def.hp > 0)) await this.applyFx(side, mv, { quiet: true, first });
    }
    if (mfx?.kind === 'recoil' && dealt > 0) {
      const loss = Math.max(1, Math.floor(dealt * mfx.amount));
      const was = atk.hp;
      atk.hp = Math.max(1, atk.hp - loss); // recoil never knocks anyone out
      if (atk.hp < was) {
        fx?.status('recoil', this.spot(side));
        this.refresh();
        await this.say(`${who} is hurt by the crash!`, 1000);
      }
    }
    if (bossLast && def.hp > 0 && def.hp <= statsFor(def).maxHp / 2) await this.powerUp(def);
  }

  labelOf(side) { return side === 'foe' ? `${this.foeLabel} ${nameOf(this.foe)}` : nameOf(this.ally); }

  // The extra effect of a move: healing, stat changes, sleep or flinch. `quiet` (a side effect of an
  // attack) skips messages that would only say "nothing happened".
  async applyFx(side, mv, { quiet = false, first = false } = {}) {
    const fx = mv.fx, vis = this.game.fx;
    const user = side === 'ally' ? this.ally : this.foe;
    const target = side === 'ally' ? this.foe : this.ally;
    const userSide = side, targetSide = side === 'ally' ? 'foe' : 'ally';
    const uWho = this.labelOf(userSide), tWho = this.labelOf(targetSide);
    if (fx.kind === 'heal') {
      const max = statsFor(user).maxHp;
      if (user.hp >= max) { await this.say(`${uWho}'s HP is already full!`, 1100); return; }
      user.hp = Math.min(max, user.hp + Math.floor(max * fx.amount));
      this.mods(user).healed++;
      sound.play('heal');
      vis?.status('heal', this.spot(userSide));
      this.refresh();
      await this.say(`${uWho} got some HP back!`, 1200);
    } else if (fx.kind === 'raise' || fx.kind === 'lower') {
      const up = fx.kind === 'raise';
      const c = up ? user : target;
      const m = this.mods(c);
      const w = up ? uWho : tWho;
      const edge = up ? m[fx.stat] >= 3 : m[fx.stat] <= -3;
      if (edge) {
        if (!quiet) await this.say(`${w}'s ${STAT_NAMES[fx.stat]} can't go any ${up ? 'higher' : 'lower'}!`, 1100);
        return;
      }
      m[fx.stat] += up ? 1 : -1;
      sound.play(up ? 'statup' : 'statdown');
      vis?.status(up ? 'up' : 'down', this.spot(up ? userSide : targetSide), { stat: fx.stat });
      this.refresh();
      await this.say(`${w}'s ${STAT_NAMES[fx.stat]} went ${up ? 'up' : 'down'}!`, 1200);
    } else if (fx.kind === 'flinch') {
      // Only works if the user moved first this turn (the other creature has not moved yet).
      if (first) this.mods(target).flinch = true;
    } else if (fx.kind === 'sleep') {
      const m = this.mods(target);
      if (m.sleep) { if (!quiet) await this.say(`But ${tWho} is already asleep!`, 1100); return; }
      m.sleep = true;
      sound.play('snooze');
      vis?.status('sleep', this.spot(targetSide));
      this.refresh();
      await this.say(`${tWho} fell asleep! Zzz`, 1300);
    }
  }

  // The champion's last creature glows and hits harder.
  async powerUp(c) {
    this.poweredUp = true;
    c.boost = 1.25;
    sound.play('powerup');
    this.game.fx?.status('power', this.spot('foe'));
    for (let i = 0; i < 4; i++) {
      tintModel(this.foeModel, 0xffd84a); await wait(90);
      tintModel(this.foeModel, null); await wait(90);
    }
    tintModel(this.foeModel, 0x806000);
    await this.say(`${nameOf(c)} is glowing with rainbow light!`, 1600);
    await this.say('It powered up! Its attacks are stronger now!', 1600);
  }

  async faintModel(model) {
    sound.play('faint');
    const y = model.position.y;
    await tween(450, t => { model.scale.setScalar(1 - t * 0.9); model.position.y = y - t * 0.3; });
    model.visible = false;
  }

  async foeFainted() {
    const g = this.game;
    await this.faintModel(this.foeModel);
    await this.say(`${this.foeLabel} ${nameOf(this.foe)} fainted!`);
    if (this.duel) {
      const d = this.duel;
      if (!this.foes.some(c => c.hp > 0)) { await this.say(`You beat ${d.name}! Great battle!`); return 'won'; }
      const next = await this.waitForThem(`Waiting for ${d.name} to choose a creature...`);
      if (next.kind === 'me-giveup') { await this.say('You gave up. Good try!'); return 'gaveup'; }
      if (next.kind === 'left') { await this.say(this.leftText(next)); return 'ended'; }
      if (next.kind === 'giveup') { await this.say(`${d.name} gave up! You win!`); return 'won'; }
      this.foeIdx = this.foeIndex(next.idx);
      await this.sendOutFoe();
      return null;
    }
    const xp = Math.floor((SPECIES[this.foe.species].baseXp * this.foe.level) / 5 * (this.trainer ? 1.5 : 1) * this.xpBoost);
    await this.giveXp(xp);
    if (this.trainer && this.foeIdx < this.foes.length - 1) {
      this.foeIdx++;
      await this.sendOutFoe();
      return null;
    }
    if (!this.trainer && Math.random() < 0.5) {
      g.cubes++;
      await this.say('You found a Capture Cube!', 1000);
    }
    return 'won';
  }

  // The active creature gets full XP; the rest of the healthy team shares half.
  async giveXp(xp) {
    await this.say(`${nameOf(this.ally)} gained ${xp} XP!`, 1000);
    const { msgs, evolved } = gainXp(this.ally, xp, { ask: true });
    this.refresh();
    for (const m of msgs) {
      if (m.learn) { await this.askForget(this.ally, m.learn); continue; }
      if (m.includes(' grew to ')) sound.play('levelup');
      if (evolved && m.includes('evolved into')) { sound.play('evolve'); await this.evolveAnimation(); }
      await this.say(m, 1400);
    }
    const others = this.game.party.filter((c, i) => i !== this.allyIdx && c.hp > 0);
    if (!others.length) return;
    const share = Math.max(1, Math.floor(xp / 2));
    await this.say(`The rest of your team gained ${share} XP.`, 1000);
    for (const c of others) {
      for (const m of gainXp(c, share, { ask: true }).msgs) {
        if (m.learn) { await this.askForget(c, m.learn); continue; }
        if (m.includes(' grew to ')) sound.play('levelup');
        await this.say(m, 1300);
      }
    }
  }

  // "Learn X? Forget which move?" A creature with four moves can learn a fifth only by forgetting one.
  async askForget(c, id) {
    const mv = MOVES[id];
    const name = nameOf(c);
    this.say(`${name} wants to learn ${mv.name}! Pick a move to forget.`, 60000);
    sound.play('ask');
    const info = [
      el('b', {}, mv.name),
      el('span', { class: 'type', style: `background:${TYPE_COLORS[mv.type]}` }, mv.type),
      el('span', { class: 'txt' }, moveInfo(id).text),
    ];
    const buttons = [{ info }];
    c.moves.forEach((old, i) => {
      const om = MOVES[old];
      buttons.push({
        label: `Forget ${om.name}`, sub: `${om.type} · ${moveInfo(old).text}`, value: i,
        style: `background:${TYPE_COLORS[om.type]};color:#111`,
      });
    });
    buttons.push({ label: `Don't learn ${mv.name}`, value: null, cls: 'wide' });
    this.root.classList.add('asking');
    const pick = await this.choose(buttons);
    this.root.classList.remove('asking');
    this.skip?.();
    if (!c.learned.includes(id)) c.learned.push(id);
    if (pick === null) { await this.say(`${name} did not learn ${mv.name}.`, 1400); return; }
    const forgot = MOVES[c.moves[pick]].name;
    c.moves[pick] = id;
    sound.play('levelup');
    await this.say(`1, 2 and... poof! ${name} forgot ${forgot} and learned ${mv.name}!`, 2200);
  }

  async evolveAnimation() {
    const old = this.allyModel;
    for (let i = 0; i < 4; i++) {
      tintModel(old, 0xffffff); await wait(120);
      tintModel(old, null); await wait(120);
    }
    await this.placeAlly(true);
    this.refresh();
  }

  async allyFainted() {
    await this.faintModel(this.allyModel);
    await this.say(`${nameOf(this.ally)} fainted!`);
    if (this.duel && !this.allies.some(c => c.hp > 0)) {
      await this.say(`${this.duel.name} won this time. Your team is fine, and you can battle again!`, 2000);
      return 'lost';
    }
    if (!this.game.party.some(c => c.hp > 0)) {
      if (this.trainer) await this.say(`You lost to ${this.trainer.name}...`);
      await this.say('Your whole team is worn out...');
      await this.say('You hurry back to your starting point to rest.');
      return 'lost';
    }
    const idx = await this.pickPartyMember(false);
    this.duel?.send({ kind: 'next', idx });
    this.allyIdx = idx;
    this.refresh();
    await this.placeAlly();
    this.cry(this.ally);
    await this.say(`Go, ${nameOf(this.ally)}!`, 900);
    return null;
  }

  async throwCube() {
    const g = this.game;
    const target = this.foeModel;
    const cube = makeCubeMesh();
    const from = g.player.eyePos.clone().add(new THREE.Vector3(0, -0.3, 0));
    const to = this.foePos.clone().add(new THREE.Vector3(0, 0.6, 0));
    g.scene.add(cube);
    sound.play('cube');
    this.say('You threw a Capture Cube!', 700);
    await tween(550, t => {
      cube.position.lerpVectors(from, to, t);
      cube.position.y += Math.sin(t * Math.PI) * 1.5;
      cube.rotation.set(t * 8, t * 6, 0);
    });
    tintModel(target, 0xffffff);
    await tween(300, t => target.scale.setScalar(1 - t));
    target.visible = false;
    const ground = this.foePos.y + 0.15;
    await tween(250, t => { cube.position.y = to.y + (ground - to.y) * t; cube.rotation.set(0, 0, 0); });

    const st = statsFor(this.foe);
    const hpFactor = 1 - (2 / 3) * (this.foe.hp / st.maxHp);
    const levelFactor = Math.max(0.5, 1 - (this.foe.level - 5) * 0.02);
    const sleepy = this.mods(this.foe).sleep ? 1.5 : 1; // a sleeping creature is easier to catch
    const p = Math.max(0.05, Math.min(0.95, SPECIES[this.foe.species].catchRate * hpFactor * levelFactor * 2.2 * sleepy));
    const shakeOk = Math.cbrt(p);

    let caught = true;
    for (let i = 0; i < 3; i++) {
      this.log.textContent = '.'.repeat(i + 1);
      sound.play('wobble');
      await tween(400, t => { cube.rotation.z = Math.sin(t * Math.PI * 2) * 0.5; });
      await wait(250);
      if (Math.random() > shakeOk) { caught = false; break; }
    }

    if (caught) {
      sound.play('caught');
      g.book?.markCaught(this.foe.species);
      g.scene.remove(cube);
      tintModel(target, null);
      await this.say(`Gotcha! ${nameOf(this.foe)} was caught!`, 1600);
      const c = this.foe;
      if (g.party.length < PARTY_MAX) {
        g.party.push(c);
      } else {
        g.box.push(c);
        await this.say(`${nameOf(c)} was sent to your Storage Box.`);
      }
      return true;
    }

    sound.play('escape');
    g.scene.remove(cube);
    target.visible = true;
    tintModel(target, null);
    await tween(250, t => target.scale.setScalar(t));
    await this.say(['Oh no! It broke free!', 'Argh! Almost had it!', 'It burst out of the cube!'][Math.floor(Math.random() * 3)]);
    return false;
  }
}

function makeCubeMesh() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), new THREE.MeshLambertMaterial({ color: 0xe33b3b }));
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.32), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  const button = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  top.position.y = 0.075; bottom.position.y = -0.075; button.position.z = 0.16;
  g.add(top, bottom, band, button);
  return g;
}

