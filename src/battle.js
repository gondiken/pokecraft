// Turn-based battles that play out in the 3D world with an HTML overlay.
import * as THREE from 'three';
import {
  SPECIES, MOVES, TYPE_COLORS, effectiveness, statsFor, nameOf, gainXp,
  xpForLevel, buildModel, tintModel, disposeModel, makeCreature, moveInfo, multiHits,
  hpPower, crewHit, setModelHealth, // T34
} from './species.js';
import { B, isSolid, mulberry32 } from './blocks.js';
import { wait, tween, easeOut, hpColor, el } from './util.js';
import { sound } from './sound.js';
import { sketchModel } from './sketch.js'; // T45
import { BOSSES, BOSS_SCALE, makeBoss, bossName } from './coopboss.js'; // T29

const PARTY_MAX = 6;
const WAKE_HIT = 3; // the 3rd hit of a multi-hit move wakes a sleeper

// Stat changes: +1 / -1 per use, at most 3 either way. Gentle: +3 is x1.75, -3 is x0.57.
const stage = s => (s >= 0 ? (4 + s) / 4 : 4 / (4 - s));
const STAT_NAMES = { atk: 'attack', def: 'defence', spd: 'speed' };
// Per-team effects of the big moves (T25). shield: { until, name } | null; gift: the next one in gets full HP + attack.
const newSide = () => ({ atk: 0, spd: 0, shield: null, gift: false });
const cap = s => s[0].toUpperCase() + s.slice(1);

export class Battle {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('battle');
    this.log = document.getElementById('b-log');
    this.actions = document.getElementById('b-actions');
    this.wildCard = document.getElementById('b-wild');
    this.allyCard = document.getElementById('b-ally');
    this.friendCard = el('div', { id: 'b-friend', class: 'bcard hidden' }); // T29: the other player's creature in a co-op battle
    this.root.appendChild(this.friendCard);
    this.coop = null;
    this.skip = null;
    this.history = [];
    this.modMap = new Map();
    this.resetSides();
    this.log.addEventListener('click', () => this.skip?.());
    this.allyModel = null;
    this.active = false;
  }

  get ally() { return this.allies[this.allyIdx]; }
  get foe() { return this.foes[this.foeIdx]; }
  get friend() { return this.friends?.[this.friendIdx]; } // T29: the other player's creature (co-op only)
  get foeLabel() { return this.coop ? 'Giant' : this.duel ? `${this.duel.name}'s` : this.trainer ? 'Foe' : 'Wild'; }

  // T29 co-op sides: 'ally' = my creature, 'friend' = the other player's, 'foe' = the giant. Outside co-op these
  // return exactly what the old ternaries did.
  creature(side) { return side === 'ally' ? this.ally : side === 'friend' ? this.friend : this.foe; }
  // Whom a move hits: our creatures hit the giant; the giant hits this.bossTarget ('ally' or 'friend').
  other(side) { return side === 'foe' ? (this.coop ? this.bossTarget || 'ally' : 'ally') : 'foe'; }
  teamSide(side) { return side === 'friend' ? 'ally' : side; } // both players' creatures are one team
  actives(teamSide) { return teamSide === 'ally' ? [this.ally, ...(this.coop && !this.friendOut && this.friend ? [this.friend] : [])] : [this.foe]; }

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
  // `sleep` = own moves it will still lose (0 = awake); `justWoke` = its free turn after waking (can't be slept again).
  mods(c) {
    let m = this.modMap.get(c);
    if (!m) {
      const s = this.sides[this.sideOf(c)]; // a creature coming in picks up its team's rally and curse
      this.modMap.set(c, m = { atk: s?.atk || 0, def: 0, spd: s?.spd || 0, sleep: 0, justWoke: false, flinch: false, healed: 0, rest: false });
    }
    return m;
  }

  // Per-team state of the big moves, the one shared field and the round counter. Never saved.
  resetSides() { this.sides = { ally: newSide(), foe: newSide() }; this.field = null; this.round = 0; }
  sideOf(c) {
    if (this.allies?.includes(c) || this.friends?.includes(c)) return 'ally';
    if (this.foes?.includes(c)) return 'foe';
    return null;
  }
  // Healthy creatures of a team that are not out (they wait on the bench).
  bench(side) {
    const list = side === 'ally' ? this.allies : side === 'friend' ? this.friends : this.foes, cur = this.creature(side);
    return (list || []).filter(c => c !== cur && c.hp > 0).length > 0;
  }
  teamName(side) {
    if (side === 'ally') return this.coop ? `Your team and ${this.duel.name}'s` : 'Your team';
    if (this.duel) return `${this.duel.name}'s team`;
    if (this.trainer) return `${this.trainer.name}'s team`;
    return 'The wild team';
  }
  shieldOn(side) { const s = this.sides[side].shield; return !!s && s.until >= this.round; }
  fieldFactor(type) { return this.field && this.field.type === type ? this.field.boost : 1; }
  turnsLeft(until, n) { return Math.min(n, until - this.round + 1); }

  // Damage taken is multiplied by this (sleeping: +25%, a team shield: -30%).
  takenFactor(c) {
    const side = this.sideOf(c);
    return (this.mods(c).sleep ? 1.25 : 1) * (side && this.shieldOn(side) ? 0.7 : 1);
  }

  // Why a creature can't use a move right now ('' = it can).
  cantUse(side, id) {
    const c = this.creature(side), fx = MOVES[id]?.fx;
    if (this.coop && fx?.kind === 'sacrifice') return 'not in a giant battle';
    if (fx?.kind === 'lastword' && c.hp >= statsFor(c).maxHp * fx.below) return 'only below 1/4 HP';
    if (fx?.kind === 'sacrifice' && !this.bench(side)) return 'no friend can come in';
    return '';
  }

  // A new round starts: shields and the field wear off. Draws no random numbers.
  async tickEffects() {
    for (const side of ['ally', 'foe']) {
      const s = this.sides[side].shield;
      if (s && s.until < this.round) {
        this.sides[side].shield = null;
        this.refresh();
        await this.say(`${s.name} wore off.`, 1000);
      }
    }
    if (this.field && this.field.until < this.round) {
      const f = this.field;
      this.field = null;
      this.refresh();
      await this.say(`${f.name} is over.`, 1000);
    }
  }

  // The next creature after a sacrifice arrives with full HP and +1 attack.
  async giftArrives(side) {
    const s = this.sides[side];
    if (!s.gift) return;
    s.gift = false;
    const c = this.creature(side);
    c.hp = statsFor(c).maxHp;
    const m = this.mods(c);
    m.atk = Math.min(3, m.atk + 1);
    sound.play('kind:gift');
    this.game.fx?.status('heal', this.spot(side));
    this.game.fx?.status('power', this.spot(side));
    this.refresh();
    await this.say(`${this.labelOf(side)} comes in fresh and strong! Full HP and more attack!`, 1400);
  }

  // Put a creature to sleep for `turns` of its own moves (2 or 3, drawn by the caller).
  async fallAsleep(side, turns) {
    const c = this.creature(side);
    this.mods(c).sleep = turns;
    sound.play('snooze');
    this.game.fx?.status('sleep', this.spot(side));
    this.refresh();
    await this.say(`${this.labelOf(side)} fell asleep! Zzz`, 1300);
  }

  // how = 'own' (slept its turns away) or 'bonk' (a multi-hit move's 3rd hit)
  async wakeUp(side, how) {
    const c = this.creature(side);
    const m = this.mods(c);
    m.sleep = 0;
    m.justWoke = true;
    this.refresh();
    const who = this.labelOf(side);
    await this.say(how === 'bonk' ? `Bonk! The third hit woke ${who} up!` : `${who} woke up!`, 1000);
  }

  // Chance (0.05 to 0.95) that a Capture Cube holds the foe.
  catchChance() {
    const st = statsFor(this.foe);
    const hpFactor = 1 - (2 / 3) * (this.foe.hp / st.maxHp);
    const levelFactor = Math.max(0.5, 1 - (this.foe.level - 5) * 0.02);
    const sleepy = this.mods(this.foe).sleep ? 1.5 : 1; // a sleeping creature is easier to catch
    return Math.max(0.05, Math.min(0.95, SPECIES[this.foe.species].catchRate * hpFactor * levelFactor * 2.2 * sleepy));
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
    if (m.rest) tags.push(el('span', { class: 'zzz' }, 'Resting'));
    const side = this.sideOf(c), sh = side && this.sides[side].shield;
    if (sh && this.shieldOn(side)) tags.push(el('span', { class: 'up' }, `${sh.name} ${this.turnsLeft(sh.until, 3)}`));
    if (this.field) tags.push(el('span', { style: `color:${TYPE_COLORS[this.field.type]}` }, `${this.field.name} ${this.turnsLeft(this.field.until, 5)}`));
    return tags.length ? el('div', { class: 'b-tags' }, ...tags) : null;
  }

  refresh() {
    this.game.book?.markSeen(this.foe.species);
    this.card(this.wildCard, this.foe, false);
    if (this.coop) { const nm = this.wildCard.querySelector('.nm'); if (nm) nm.textContent = bossName(this.coop.boss); } // T29
    this.card(this.allyCard, this.ally, true);
    if (this.coop && this.friend) { // T29
      this.card(this.friendCard, this.friend, true);
      const nm = this.friendCard.querySelector('.nm');
      if (nm) nm.textContent = `${this.duel.name}'s ${nm.textContent}`;
    }
    // T34: crews show their health (generic: a no-op for models without members)
    for (const [m, c] of [[this.allyModel, this.ally], [this.foeModel, this.foe], [this.friendModel, this.friend]]) {
      if (m && c && m.userData.who === c) setModelHealth(m, c.hp / statsFor(c).maxHp);
    }
  }

  // T34: remember which creature a battle model shows, and start it with the members its health allows.
  showsCreature(model, c) {
    model.userData.who = c;
    setModelHealth(model, c.hp / statsFor(c).maxHp, { instant: true });
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
      const resting = this.mods(this.ally).rest;
      const moves = this.ally.moves.map(id => {
        const mv = MOVES[id];
        const why = resting ? 'resting this turn' : this.cantUse('ally', id);
        return {
          label: mv.name, sub: `${mv.type} · ${why || moveInfo(id).text}`, value: { kind: 'move', move: id }, disabled: !!why,
          style: `background:${TYPE_COLORS[mv.type]};color:#111`,
        };
      });
      // Resting or nothing usable: one wide button passes the turn (the move is refused in useMove).
      if (moves.every(m => m.disabled)) {
        moves.unshift({ label: resting ? 'Rest' : 'Wait', sub: resting ? 'You rest after the shield.' : 'No move works right now.', value: { kind: 'move', move: this.ally.moves[0] }, cls: 'wide primary' });
      }
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
    const pos = p.clone().addScaledVector(dir, Math.min(2.6, gap * 0.45)).addScaledVector(right, 1.5 * (this.coop ? this.coopSign() : 1));
    pos.y = this.groundBelow(pos.x, pos.z, p.y + 1);
    const model = buildModel(this.ally.species); sketchModel(model); // T45
    model.position.copy(pos);
    model.rotation.y = Math.atan2(w.x - pos.x, w.z - pos.z);
    this.showsCreature(model, this.ally);
    g.scene.add(model);
    this.allyModel = model;
    this.allyHome = pos.clone();
    return tween(300, t => model.scale.setScalar(easeOut(t)));
  }

  // T29: which way my creature stands from me (+1 right, -1 left): away from the friend, so the two never overlap.
  coopSign() {
    const p = this.game.player.pos, a = this.duel.avatar.pos, w = this.foePos;
    const dx = w.x - p.x, dz = w.z - p.z, len = Math.hypot(dx, dz) || 1;
    const lateral = (a.x - p.x) * (-dz / len) + (a.z - p.z) * (dx / len); // positive = friend on my right
    return lateral > 0.01 ? -1 : 1;
  }

  // T29: the friend's creature stands next to the friend's avatar, on the side away from me.
  placeFriend() {
    const g = this.game;
    this.modMap.delete(this.friend);
    if (this.friendModel) { g.scene.remove(this.friendModel); disposeModel(this.friendModel); }
    const a = this.duel.avatar.pos, w = this.foePos;
    const dir = new THREE.Vector3(w.x - a.x, 0, w.z - a.z);
    const gap = dir.length();
    dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const pos = a.clone().addScaledVector(dir, Math.min(2.6, gap * 0.45)).addScaledVector(right, -1.5 * this.coopSign());
    pos.y = this.groundBelow(pos.x, pos.z, a.y + 1);
    const model = buildModel(this.friend.species); sketchModel(model); // T45
    model.position.copy(pos);
    model.rotation.y = Math.atan2(w.x - pos.x, w.z - pos.z);
    this.showsCreature(model, this.friend);
    g.scene.add(model);
    this.friendModel = model;
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

  modelOf(side) { return side === 'ally' ? this.allyModel : side === 'friend' ? this.friendModel : this.foeModel; }

  // Where a creature is, for the attack animations (null when it has no model on screen).
  spot(side) {
    const m = this.modelOf(side);
    if (!m || !m.parent || !m.visible) return null;
    const box = new THREE.Box3();
    const members = m.userData.parts?.members;
    if (members?.length) { m.updateMatrixWorld(true); for (const mm of members) { if (mm.g.visible) box.expandByObject(mm.g); } } // T34: what is left of the stack
    else box.setFromObject(m);
    if (box.isEmpty()) return null;
    const pos = box.getCenter(new THREE.Vector3());
    return { pos, top: box.max.y, r: Math.max(0.3, (box.max.x - box.min.x) / 2) };
  }

  // Trainer battles: put the trainer's current creature between them and the player.
  async sendOutFoe() {
    const g = this.game;
    if (this.coop) return this.sendOutGiant();
    const npc = this.trainer;
    this.modMap.delete(this.foe);
    if (this.foeModel) { g.scene.remove(this.foeModel); disposeModel(this.foeModel); }
    const p = g.player.pos;
    const dir = new THREE.Vector3(p.x - npc.pos.x, 0, p.z - npc.pos.z);
    const dist = dir.length();
    dir.normalize();
    const pos = npc.pos.clone().addScaledVector(dir, Math.min(2.2, dist * 0.4));
    pos.y = this.groundBelow(pos.x, pos.z, npc.pos.y + 0.5);
    const model = buildModel(this.foe.species); sketchModel(model); // T45
    model.position.copy(pos);
    model.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
    model.scale.setScalar(0.01);
    this.showsCreature(model, this.foe);
    g.scene.add(model);
    this.foeModel = model;
    this.foePos = pos;
    this.refresh();
    this.say(`${npc.name} sent out ${nameOf(this.foe)}!`, 1200);
    this.cry(this.foe);
    await tween(300, t => model.scale.setScalar(easeOut(t)));
    await wait(900);
    await this.giftArrives('foe');
  }

  // T29: the giant appears where the ask said, facing the two players, and grows to its big size.
  async sendOutGiant() {
    const g = this.game;
    const at = this.foePos;
    this.modMap.delete(this.foe);
    const mid = g.player.pos.clone().add(this.duel.avatar.pos).multiplyScalar(0.5);
    const model = buildModel(this.foe.species); sketchModel(model); // T45
    model.position.copy(at);
    model.rotation.y = Math.atan2(mid.x - at.x, mid.z - at.z);
    model.scale.setScalar(0.01);
    this.showsCreature(model, this.foe);
    g.scene.add(model);
    this.foeModel = model;
    this.refresh();
    this.cry(this.foe);
    await tween(500, t => model.scale.setScalar(Math.max(0.01, easeOut(t) * BOSS_SCALE)));
  }

  async lunge(side) {
    const a = this.modelOf(side), b = this.modelOf(this.other(side));
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
    this.resetSides();
    this.history = [];
    this.xpBoost = opts.xpBoost || 1;
    this.surprise = !!opts.surprise && !this.duel && !opts.wild; // T37b: a sneak attack (Shadow Dojo): your creature moves first in round 1
    this.order = null; // the last turn's order of sides (tests)
    this.coop = this.duel?.coop || null; // T29: 2 players against one giant
    this.trainer = opts.trainer || (this.coop ? { name: bossName(this.coop.boss), pos: new THREE.Vector3(...this.coop.at) } : this.duel && { name: this.duel.name, pos: this.duel.pos });
    this.foeModel = null;
    this.friends = null; this.friendIdx = 0; this.friendModel = null; this.myOut = false; this.friendOut = false;
    this.bossTarget = null; this.trace = [];
    this.friendCard.classList.add('hidden');
    this.foeIdx = 0;
    // Battles between players use full-HP copies of each team, so nobody's real team gets hurt.
    const copy = c => makeCreature(c.species, Math.max(1, Math.min(60, c.level | 0)), c.moves);
    this.allies = this.duel ? g.party.map(copy) : g.party;
    this.allyIdx = this.allies.findIndex(c => c.hp > 0);
    if (this.coop) {
      this.friends = this.duel.team.filter(c => SPECIES[c?.species]).slice(0, PARTY_MAX).map(copy);
      this.friendIdx = Math.max(0, this.friends.findIndex(c => c.hp > 0));
    }
    this.root.classList.remove('hidden');
    this.actions.replaceChildren();
    sound.play(this.boss ? 'boss' : 'battle');
    if (this.boss) this.music = setInterval(() => sound.play('bossloop'), 6400);

    if (this.wild) {
      const wild = this.wild;
      const was = wild.reveal?.(); // a Camo creature pops out of its block (before its model is used below)
      this.foes = [wild.data];
      wild.frozen = true;
      wild.face(g.player.pos);
      this.foeModel = wild.model;
      this.showsCreature(wild.model, wild.data); // T34
      this.foePos = wild.pos;
      this.stepBack(wild.pos, 4.5);
      g.player.lookAt(new THREE.Vector3(wild.pos.x, wild.pos.y + 0.5, wild.pos.z));
      this.refresh();
      this.cry(this.foe);
      await this.say(was?.gift ? `Surprise! The gift was a wild ${nameOf(this.foe)}!` /* T44 */ : was ? `That ${was} block was a wild ${nameOf(this.foe)}!` : `A wild ${nameOf(this.foe)} appeared!`);
    } else if (this.coop) {
      const npc = this.trainer;
      this.foes = [makeBoss(this.coop.boss, this.allies, this.friends, this.coop.grow || 0)]; // T38c
      this.stepBack(npc.pos, 5.5);
      g.player.lookAt(new THREE.Vector3(npc.pos.x, npc.pos.y + 1.2 * BOSS_SCALE, npc.pos.z));
      this.foePos = npc.pos.clone();
      this.refresh();
      await this.say(`A giant ${nameOf(this.foe)} appeared! Beat it together with ${this.duel.name}!`, 2000);
      if (this.coop.grow > 0) await this.say('It looks even bigger than last time!', 1600); // T38c
      await this.sendOutFoe();
    } else {
      const npc = this.trainer;
      this.foes = this.duel ? this.duel.team.filter(c => SPECIES[c?.species]).slice(0, 6).map(copy) : opts.team.map(([species, level, moves]) => makeCreature(species, level, moves));
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
    if (this.surprise) await this.say(`Surprise attack! ${nameOf(this.ally)} moves first!`, 1400); // T37b
    if (this.coop) {
      await this.placeFriend();
      this.refresh();
      this.friendCard.classList.remove('hidden');
      this.cry(this.friend);
      await this.say(`${this.duel.name} sent out ${nameOf(this.friend)}!`, 1000);
    }

    let result = null;
    try {
      while (!result) result = await this.turn();
    } catch (e) { // a bug must never freeze the game: end the battle like running away (a duel just ends)
      console.error('battle turn failed', e);
      this.say?.('Oops! Something went wrong. Let\'s go back to exploring.', 1500)?.catch?.(() => {});
      result = this.duel ? 'ended' : 'ran';
    }
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
    if (this.friendModel) { g.scene.remove(this.friendModel); disposeModel(this.friendModel); this.friendModel = null; } // T29
    this.friendCard.classList.add('hidden');
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
    if (this.coop && result !== 'gaveup') return result === 'won' ? `You and ${this.duel.name} beat the giant!` : result === 'lost' ? 'The giant was too strong this time.' : 'The giant battle is over.';
    if (result === 'won') return this.trainer ? `You beat ${this.trainer.name}!` : 'You won!';
    if (result === 'ran') return 'You got away.';
    if (result === 'lost') return this.duel ? `${this.duel.name} won this time.` : 'Your team is resting at the start.';
    if (result === 'gaveup') return 'You gave up.';
    return '';
  }

  async turn() {
    this.round++;
    await this.tickEffects(); // draws nothing
    if (this.coop) return this.coopTurn(); // T29
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
    // T37b: a surprise attack goes first in round 1 whatever the speed or priority (decided before any draw, so no new draws).
    const allyFirst = (this.surprise && this.round === 1) || (MOVES[action.move].priority || 0) - (MOVES[foeMove].priority || 0) ||
      this.speedOf(this.ally) - this.speedOf(this.foe) || Math.random() - 0.5;
    const order = allyFirst > 0
      ? [['ally', action.move], ['foe', foeMove]]
      : [['foe', foeMove], ['ally', action.move]];
    this.order = order.map(o => o[0]);
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

  /* ---------------------------- T29: co-op boss ---------------------------- */
  // Two players against one giant, on the duel messages. What both browsers must agree on: the order of the
  // actions (priority, speed, then role rank asker/helper/giant: no draw), draw B (the giant's target, only
  // when both players are still in, drawn just before the giant's move), then each useMove's draws in the
  // usual order. Switches and faint picks come as messages in the same order as in duels. The player who is
  // out keeps sending { kind: 'watch' } every turn, so the number of messages per turn never changes.
  // Roles: p1 = the asker (duel.first), p2 = the helper. 'ally' is always MY creature, 'friend' the other one's.
  async coopTurn() {
    const d = this.duel, rank = s => s === 'foe' ? 2 : (s === 'ally') === d.first ? 0 : 1;
    const mine = this.myOut ? { kind: 'watch' } : await this.chooseAction();
    d.send(mine);
    if (mine.kind === 'giveup') { await this.say('You left the giant battle.'); return 'gaveup'; }
    const theirs = await this.waitForThem(`Waiting for ${d.name}...`);
    if (theirs.kind === 'me-giveup') { await this.say('You left the giant battle.'); return 'gaveup'; }
    if (theirs.kind === 'left') { await this.say(this.leftText(theirs)); return 'ended'; }
    if (theirs.kind === 'giveup') { await this.say(`${d.name} left the giant battle.`); return 'ended'; }

    if (mine.kind === 'switch') {
      await this.say(`Come back, ${nameOf(this.ally)}!`, 800);
      this.allyIdx = mine.idx;
      this.refresh();
      await this.placeAlly();
      this.cry(this.ally);
      await this.say(`Go, ${nameOf(this.ally)}!`, 900);
    }
    if (theirs.kind === 'switch') {
      const idx = this.friends[theirs.idx]?.hp > 0 ? theirs.idx : this.friends.findIndex(c => c.hp > 0);
      if (idx >= 0 && idx !== this.friendIdx) {
        this.friendIdx = idx;
        this.refresh();
        await this.placeFriend();
        this.cry(this.friend);
        await this.say(`${d.name} sent out ${nameOf(this.friend)}!`, 900);
      }
    }
    const acts = []; // [side, move, the creature that acts]
    if (mine.kind === 'move') acts.push(['ally', mine.move, this.ally]);
    if (theirs.kind === 'move') acts.push(['friend', MOVES[theirs.move] ? theirs.move : 'tackle', this.friend]);
    if (this.foe.hp > 0) acts.push(['foe', this.bossMove(), this.foe]);
    acts.sort((a, b) => (MOVES[b[1]].priority || 0) - (MOVES[a[1]].priority || 0)
      || this.speedOf(this.creature(b[0])) - this.speedOf(this.creature(a[0])) || rank(a[0]) - rank(b[0])); // no draw for ties
    this.clearFlinch();
    const acted = new Set();
    for (const [side, move, actor] of acts) {
      if (this.creature(side) !== actor || actor.hp <= 0) continue; // fainted (or was replaced) earlier this turn
      if (side === 'foe') this.bossTarget = this.pickTarget(); // draw B
      await this.useMove(side, move, { first: !acted.has(this.other(side)) });
      acted.add(side);
      this.trace.push([this.round, rank(side), move, ...this.hpByRole()]);
      if (this.foe.hp <= 0) return this.coopWon();
      if (this.ally.hp <= 0 && !this.myOut) await this.coopAllyFainted();
      if (this.friend.hp <= 0 && !this.friendOut) { const r = await this.coopFriendFainted(); if (r) return r; }
      if (this.myOut && this.friendOut) { await this.say('The giant was too strong this time!', 1600); return 'lost'; }
    }
    this.clearFlinch();
    await this.warnBig();
    return null;
  }

  // The giant's target this turn: whoever is still in, or a shared coin flip (draw B) when both are.
  pickTarget() {
    if (this.myOut) return 'friend';
    if (this.friendOut) return 'ally';
    const p1 = this.duel.first ? 'ally' : 'friend', p2 = p1 === 'ally' ? 'friend' : 'ally';
    return this.rng() < 0.5 ? p1 : p2;
  }

  // What the giant does in a round: its plan, going round and round. No draws.
  plannedMove(round) {
    const b = BOSSES[this.coop.boss], step = b.plan[(round - 1) % b.plan.length];
    const hits = this.foe.moves.filter(id => MOVES[id].power > 0 && !MOVES[id].big)
      .sort((x, y) => MOVES[y].power - MOVES[x].power || (x < y ? -1 : 1));
    if (step === 'a') return hits[0] || this.foe.moves[0];
    if (step === 'b') return hits[1] || hits[0] || this.foe.moves[0];
    return this.foe.moves.includes(step) && !this.cantUse('foe', step) ? step : hits[0] || this.foe.moves[0];
  }
  bossMove() { return this.plannedMove(this.round); }

  // One round before a big move the giant says so. No draws.
  async warnBig() {
    if (this.foe.hp <= 0) return;
    const step = BOSSES[this.coop.boss].plan[this.round % BOSSES[this.coop.boss].plan.length];
    if (MOVES[step]?.big && this.foe.moves.includes(step) && !this.cantUse('foe', step)) {
      await this.say(`${this.labelOf('foe')} is getting ready for something big!`, 1500);
    }
  }

  hpByRole() { // [asker's creature, helper's creature, giant]: the same order in both browsers
    const [p1, p2] = this.duel.first ? [this.ally, this.friend] : [this.friend, this.ally];
    return [p1.hp, p2.hp, this.foe.hp];
  }

  async coopAllyFainted() {
    await this.faintModel(this.allyModel);
    await this.say(`${nameOf(this.ally)} fainted!`);
    if (this.allies.some(c => c.hp > 0)) {
      const idx = await this.pickPartyMember(false);
      this.duel.send({ kind: 'next', idx });
      this.allyIdx = idx;
      this.refresh();
      await this.placeAlly();
      this.cry(this.ally);
      await this.say(`Go, ${nameOf(this.ally)}!`, 900);
    } else {
      this.myOut = true;
      this.duel.send({ kind: 'next', idx: -1 });
      this.refresh();
      await this.say(`Your team is tired out. Cheer for ${this.duel.name}!`, 1600);
    }
  }

  // The friend's creature fainted: wait for their pick (the same order of messages as in duels).
  async coopFriendFainted() {
    const d = this.duel;
    await this.faintModel(this.friendModel);
    await this.say(`${this.labelOf('friend')} fainted!`);
    const next = await this.waitForThem(`Waiting for ${d.name} to choose a creature...`);
    if (next.kind === 'me-giveup') { await this.say('You left the giant battle.'); return 'gaveup'; }
    if (next.kind === 'left') { await this.say(this.leftText(next)); return 'ended'; }
    if (next.kind === 'giveup') { await this.say(`${d.name} left the giant battle.`); return 'ended'; }
    const idx = next.idx;
    if (!(idx >= 0) || !this.friends[idx] || this.friends[idx].hp <= 0) {
      this.friendOut = true;
      this.refresh();
      await this.say(`${d.name}'s team is tired out!`, 1500);
      return null;
    }
    this.friendIdx = idx;
    this.refresh();
    await this.placeFriend();
    this.cry(this.friend);
    await this.say(`${d.name} sent out ${nameOf(this.friend)}!`, 900);
    return null;
  }

  async coopWon() {
    await this.faintModel(this.foeModel);
    await this.say(`You and ${this.duel.name} beat the ${this.trainer.name}!`, 1800);
    sound.play('champion');
    return 'won';
  }

  clearFlinch() {
    this.mods(this.ally).flinch = false;
    this.mods(this.foe).flinch = false;
    if (this.coop && this.friend) this.mods(this.friend).flinch = false;
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
    const maxHp = statsFor(foe).maxHp, fb = this.bench('foe') ? 1 : 0;
    const score = id => {
      const mv = MOVES[id];
      if (mv.fx?.kind === 'risky' && foe.hp < maxHp * 0.4) return 0;
      if (mv.power > 0) {
        const eff = effectiveness(mv.type, allyType);
        if (eff === 0) return 0;
        const stab = mv.type === foeType ? 1.5 : 1;
        return mv.power * eff * stab * (mv.sure ? 1 : mv.acc) * (mv.fx?.kind === 'multi' ? 3 : 1) * crewHit(ally, mv) * this.takenFactor(ally) * this.fieldFactor(mv.type);
      }
      const fx = mv.fx;
      if (fx.kind === 'heal') return foe.hp < statsFor(foe).maxHp * 0.45 && fm.healed < 1 ? 120 : 0;
      if (fx.kind === 'raise') return fm[fx.stat] < 2 && foe.hp > statsFor(foe).maxHp * 0.6 ? 45 : 0;
      if (fx.kind === 'lower') return am[fx.stat] > -2 ? 40 : 0;
      if (fx.kind === 'sleep') return am.sleep || am.justWoke ? 0 : 55;
      if (fx.kind === 'rally') return this.sides.foe.atk < 1 && foe.hp > maxHp * 0.6 && fb >= 1 ? 40 + 10 * Math.min(fb, 2) : 0;
      if (fx.kind === 'shield') return !this.shieldOn('foe') && foe.hp > maxHp * 0.5 && fb >= 1 ? 40 : 0;
      if (fx.kind === 'curse') return am.spd > -2 && this.sides.ally.spd > -2 ? 30 : 0;
      if (fx.kind === 'field') return this.field?.type !== mv.type && foe.moves.some(m => MOVES[m].type === mv.type && MOVES[m].power > 0) ? 45 : 0;
      if (fx.kind === 'sacrifice') return fb >= 1 && foe.hp < maxHp * 0.3 ? 50 : 0;
      return 0;
    };
    const usable = foe.moves.filter(id => !this.cantUse('foe', id));
    const scored = (usable.length ? usable : foe.moves).map(id => [id, score(id)]);
    if (Math.random() < 0.5) {
      const best = Math.max(...scored.map(s => s[1]));
      const top = scored.filter(s => s[1] === best);
      return top[Math.floor(Math.random() * top.length)][0];
    }
    const ok = scored.filter(s => s[1] > 0);
    const pool = ok.length ? ok : scored;
    return pool[Math.floor(Math.random() * pool.length)][0];
  }

  // One creature uses a move. The random numbers are drawn in a fixed order (1 hit, 2 number of hits
  // (multi only), 3 critical, 4 damage roll, 7 risky coin (right after 4), 5 effect chance (moves with `chance`),
  // 6 sleep length (whenever a sleep effect lands), B the giant's target (co-op only, just before its move), 8 curse roll (first thing in the curse branch). Sleeping,
  // resting, flinching, a blocked move and the wake-up hit draw nothing) and never depend on which side is moving,
  // because in a player battle both browsers must draw exactly the same numbers.
  async useMove(side, moveId, { first = false } = {}) {
    const atk = this.creature(side);
    const defSide = this.other(side); // T29: in co-op the giant hits whoever bossTarget says
    const def = this.creature(defSide);
    const mv = MOVES[moveId];
    const who = this.labelOf(side);
    const ma = this.mods(atk), md = this.mods(def);
    const fx = this.game.fx; // attack animations (never draw random numbers, never block)
    // A flinched or sleepy creature loses its move.
    if (ma.flinch) {
      ma.flinch = false;
      ma.rest = false;
      fx?.status('flinch', this.spot(side));
      await this.say(`${who} flinched and couldn't move!`, 1100);
      return;
    }
    if (ma.sleep) {
      ma.rest = false;
      sound.play('snooze');
      fx?.status('sleep', this.spot(side));
      await this.say(`${who} is fast asleep... Zzz`, 1100);
      ma.sleep--;
      if (!ma.sleep) await this.wakeUp(side, 'own');
      else this.refresh();
      return;
    }
    if (ma.rest) { // the turn after a team shield: no draws
      ma.rest = false;
      this.refresh();
      await this.say(`${who} is resting after the shield.`, 1100);
      return;
    }
    const why = this.cantUse(side, moveId);
    if (why) { await this.say(`${who} can't use ${mv.name} now: ${why}!`, 1100); return; } // no draws
    ma.justWoke = false; // it is awake and gets to act: its free turn is used up
    this.say(`${who} used ${mv.name}!`, 700);
    sound.play(sound.has(moveId) ? moveId : `fx:${mv.type}`); // sound-type moves have their own sound
    await this.lunge(side);
    await wait(150);
    const hit = this.rng(); // draw 1: always, even for moves that never miss
    if (!mv.sure && hit > mv.acc) { sound.play('miss'); fx?.status('miss', this.spot(defSide), { from: this.spot(side) }); await this.say('But it missed!', 1000); return; }
    if (!mv.power) { fx?.aura(mv.type, this.spot(side)); await this.applyFx(side, mv, { first }); return; }

    const mfx = mv.fx;
    let hits = 1;
    if (mfx?.kind === 'multi') hits = multiHits(mfx, this.rng()); // draw 2
    const as = statsFor(atk), ds = statsFor(def);
    const eff = effectiveness(mv.type, SPECIES[def.species].type);
    const stab = mv.type === SPECIES[atk.species].type ? 1.5 : 1;
    const crit = this.rng() < 1 / 16 ? 1.5 : 1; // draw 3
    const atkPower = as.atk * stage(ma.atk) * (atk.boost || 1) * hpPower(atk), defPower = ds.def * stage(md.def);
    const base = Math.floor((((2 * atk.level) / 5 + 2) * mv.power * atkPower / defPower) / 50) + 2;
    const roll = 0.85 + this.rng() * 0.15; // draw 4
    let mult = 1;
    if (mfx?.kind === 'risky') { // draw 7: right after the damage roll
      if (this.rng() < mfx.odds) mult = mfx.times;
      else { await this.backfire(side, mv, roll); return; }
    }
    if (mfx?.kind === 'lastword') { fx?.status('power', this.spot(side)); sound.play('kind:lastword'); }
    const dmgNow = () => Math.max(1, Math.floor(base * stab * eff * crewHit(def, mv) * crit * mult * this.fieldFactor(mv.type) * this.takenFactor(def) * roll));
    const hpStart = def.hp;
    // The champion's last creature hangs on once and powers up at half HP.
    const bossLast = this.boss && side !== 'foe' && this.foeIdx === this.foes.length - 1 && !this.poweredUp;
    let done = 0;
    await fx?.attack(moveId, this.spot(side), this.spot(defSide));
    for (let i = 0; i < hits && def.hp > 0; i++) {
      const hpBefore = def.hp;
      def.hp = Math.max(0, def.hp - dmgNow());
      if (bossLast && def.hp <= 0 && hpBefore > statsFor(def).maxHp / 2) def.hp = 1;
      done++;
      sound.play(eff > 1 ? 'super' : 'hit');
      this.flash(defSide);
      fx?.impact(mv.type, this.spot(defSide), { big: !!mv.sig || mult > 1 || mfx?.kind === 'lastword' });
      this.refresh();
      await wait(hits > 1 ? 300 : 450);
      if (mfx?.kind === 'multi' && i === WAKE_HIT - 1 && md.sleep && def.hp > 0 && eff > 0) await this.wakeUp(defSide, 'bonk');
    }
    const dealt = hpStart - def.hp;
    if (crit > 1) await this.say('A critical hit!', 900);
    if (eff === 0) await this.say(`It doesn't affect ${nameOf(def)}...`, 1100);
    else if (eff > 1) await this.say("It's super effective!", 1000);
    else if (eff < 1) await this.say("It's not very effective...", 1000);
    if (hits > 1 && eff > 0) await this.say(`Hit ${done} times!`, 900);
    if (mult > 1 && eff > 0) { sound.play('kind:jackpot'); await this.say('Wow! Three times the power!', 1000); }

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

  // A risky move that went wrong: the user hits itself with the move's power. No STAB, type, crit or field.
  async backfire(side, mv, roll) {
    const atk = this.creature(side), ma = this.mods(atk), fx = this.game.fx;
    const st = statsFor(atk);
    const selfBase = Math.floor((((2 * atk.level) / 5 + 2) * mv.power * st.atk * stage(ma.atk) * (atk.boost || 1) * hpPower(atk) / (st.def * stage(ma.def))) / 50) + 2;
    const loss = Math.max(1, Math.floor(selfBase * roll * this.takenFactor(atk)));
    atk.hp = Math.max(0, atk.hp - loss);
    sound.play('kind:oops');
    fx?.status('recoil', this.spot(side));
    fx?.impact(mv.type, this.spot(side));
    this.flash(side);
    this.refresh();
    await wait(450);
    await this.say(`Oh no! ${this.labelOf(side)} hit itself!`, 1200);
  }

  labelOf(side) {
    if (side === 'friend') return `${this.duel.name}'s ${nameOf(this.friend)}`; // T29
    return side === 'foe' ? `${this.foeLabel} ${nameOf(this.foe)}` : nameOf(this.ally);
  }

  // The extra effect of a move: healing, stat changes, sleep or flinch. `quiet` (a side effect of an
  // attack) skips messages that would only say "nothing happened".
  async applyFx(side, mv, { quiet = false, first = false } = {}) {
    const fx = mv.fx, vis = this.game.fx;
    const user = this.creature(side);
    const targetSide = this.other(side), target = this.creature(targetSide);
    const userSide = side;
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
      const turns = this.rng() < 0.5 ? 2 : 3; // draw 6: FIRST thing whenever a sleep effect lands, even if it then fails
      const m = this.mods(target);
      if (m.sleep) { if (!quiet) await this.say(`But ${tWho} is already asleep!`, 1100); return; }
      if (m.justWoke) { if (!quiet) await this.say(`${tWho} just woke up and is wide awake!`, 1100); return; }
      await this.fallAsleep(targetSide, turns);
    } else if (fx.kind === 'rally') {
      const uTeam = this.teamSide(userSide), s = this.sides[uTeam], m = this.mods(user);
      if (m.atk >= 3 && s.atk >= 3) { await this.say(`${this.teamName(uTeam)}'s attack can't go any higher!`, 1100); return; }
      for (const c of this.actives(uTeam)) { const cm = this.mods(c); cm.atk = Math.min(3, cm.atk + fx.atk); } // T29: both players' creatures in co-op
      s.atk = Math.min(3, s.atk + fx.atk);
      sound.play('kind:rally');
      vis?.status('rally', this.spot(userSide), { type: mv.type });
      this.refresh();
      await this.say(`${this.teamName(uTeam)} feels stronger! Attack up!`, 1300);
      const before = m.def;
      m.def = Math.max(-3, m.def + fx.def);
      if (m.def !== before) {
        sound.play('statdown');
        vis?.status('down', this.spot(userSide), { stat: 'def' });
        this.refresh();
        await this.say(`${uWho}'s defence went down ${before - m.def}!`, 1200);
      }
    } else if (fx.kind === 'shield') {
      this.sides[this.teamSide(userSide)].shield = { until: this.round + fx.turns, name: mv.name };
      this.mods(user).rest = true;
      sound.play('kind:shield');
      vis?.status('shield', this.spot(userSide), { type: mv.type });
      this.refresh();
      await this.say(`${mv.name} covers ${this.teamName(this.teamSide(userSide))} for ${fx.turns} turns!`, 1300);
      await this.say(`${uWho} will rest next turn.`, 1000);
    } else if (fx.kind === 'sacrifice') {
      if (!this.bench(userSide)) { await this.say('But no friend can come in!', 1100); return; }
      sound.play('kind:gift');
      vis?.status('sacrifice', this.spot(userSide), { type: mv.type });
      user.hp = 0;
      this.sides[userSide].gift = true;
      this.refresh();
      await this.say(`${uWho} gave everything for the team!`, 1300);
    } else if (fx.kind === 'curse') {
      const r = this.rng(); // draw 8: always, first thing in the branch
      if (r >= fx.odds) {
        vis?.status('miss', this.spot(targetSide), { from: this.spot(userSide) });
        await this.say("But it didn't work...", 1100);
        return;
      }
      const tTeam = this.teamSide(targetSide), s = this.sides[tTeam], m = this.mods(target);
      if (m.spd <= -3 && s.spd <= -3) { await this.say(`${this.teamName(tTeam)} can't get any slower!`, 1100); return; }
      for (const c of this.actives(tTeam)) { const cm = this.mods(c); cm.spd = Math.max(-3, cm.spd + fx.spd); } // T29
      s.spd = Math.max(-3, s.spd + fx.spd);
      sound.play('kind:curse');
      vis?.status('curse', this.spot(targetSide), { type: mv.type, from: this.spot(userSide) });
      this.refresh();
      await this.say(`${this.teamName(tTeam)} got slower!`, 1300);
    } else if (fx.kind === 'field') {
      this.field = { type: mv.type, name: mv.name, boost: fx.boost, until: this.round + fx.turns };
      sound.play('kind:field');
      vis?.status('field', this.spot(userSide), { type: mv.type, from: this.spot(targetSide) });
      this.refresh();
      await this.say(`${mv.name}! ${cap(mv.type)} moves are stronger for ${fx.turns} turns. For everyone!`, 1400);
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
    const y = model.position.y, s0 = model.scale.x; // T29: the giant is bigger than 1
    await tween(450, t => { model.scale.setScalar(s0 * (1 - t * 0.9)); model.position.y = y - t * 0.3; });
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
    await this.giftArrives('ally');
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

    const p = this.catchChance();
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
      g.missions?.caught?.(this.foe); // T38c
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

