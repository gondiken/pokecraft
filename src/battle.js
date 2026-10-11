// Turn-based battles that play out in the 3D world with an HTML overlay.
import * as THREE from 'three';
import {
  SPECIES, MOVES, TYPE_COLORS, effectiveness, statsFor, nameOf, gainXp,
  xpForLevel, buildModel, tintModel, disposeModel, makeCreature,
} from './species.js';
import { B, isSolid } from './blocks.js';
import { wait, tween, easeOut, hpColor, el } from './util.js';
import { sound } from './sound.js';

const PARTY_MAX = 6;

export class Battle {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('battle');
    this.log = document.getElementById('b-log');
    this.actions = document.getElementById('b-actions');
    this.wildCard = document.getElementById('b-wild');
    this.allyCard = document.getElementById('b-ally');
    this.skip = null;
    this.log.addEventListener('click', () => this.skip?.());
    this.allyModel = null;
    this.active = false;
  }

  get ally() { return this.game.party[this.allyIdx]; }
  get foe() { return this.foes[this.foeIdx]; }
  get foeLabel() { return this.trainer ? 'Foe' : 'Wild'; }

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

  say(text, ms = 1300) {
    this.log.textContent = text;
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
    ].filter(Boolean));
  }

  refresh() {
    this.card(this.wildCard, this.foe, false);
    this.card(this.allyCard, this.ally, true);
  }

  choose(buttons) {
    return new Promise(resolve => {
      this.actions.replaceChildren(...buttons.map(b => {
        if (b.row) return el('div', { class: 'row3' }, ...b.row.map(r => this.button(r, resolve)));
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
          label: mv.name, sub: `${mv.type} · power ${mv.power}`, value: { kind: 'move', move: id },
          style: `background:${TYPE_COLORS[mv.type]};color:#111`,
        };
      });
      const canSwitch = g.party.some((c, i) => i !== this.allyIdx && c.hp > 0);
      const trainer = !!this.trainer;
      const choice = await this.choose([
        ...moves,
        { row: [
          { label: trainer ? 'Cube' : `Cube x${g.cubes}`, value: { kind: 'catch' }, disabled: trainer || g.cubes <= 0, cls: 'primary' },
          { label: 'Switch', value: { kind: 'switch' }, disabled: !canSwitch },
          { label: 'Run', value: { kind: 'run' }, disabled: trainer },
        ] },
      ]);
      if (choice.kind !== 'switch') return choice;
      const idx = await this.pickPartyMember(true);
      if (idx !== null) return { kind: 'switch', idx };
    }
  }

  async pickPartyMember(allowBack) {
    this.log.textContent = 'Choose a creature.';
    const opts = this.game.party.map((c, i) => ({
      label: `${nameOf(c)} Lv${c.level}`, sub: `HP ${c.hp}/${statsFor(c).maxHp}`,
      value: i, disabled: c.hp <= 0 || i === this.allyIdx,
    }));
    if (allowBack) opts.push({ label: 'Back', value: null, cls: 'wide' });
    return this.choose(opts);
  }

  /* ------------------------------ 3D staging ------------------------------ */

  placeAlly() {
    const g = this.game;
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

  // Trainer battles: put the trainer's current creature between them and the player.
  async sendOutFoe() {
    const g = this.game;
    const npc = this.trainer;
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

  // opts is { wild } for a wild creature, or { trainer, team, intro } for a trainer battle.
  async start(opts) {
    const g = this.game;
    this.active = true;
    this.wild = opts.wild || null;
    this.trainer = opts.trainer || null;
    this.foeModel = null;
    this.foeIdx = 0;
    this.allyIdx = g.party.findIndex(c => c.hp > 0);
    this.root.classList.remove('hidden');
    this.actions.replaceChildren();
    sound.play('battle');

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
      await this.say(`A wild ${nameOf(this.foe)} appeared!`);
    } else {
      const npc = this.trainer;
      this.foes = opts.team.map(([species, level]) => makeCreature(species, level));
      this.stepBack(npc.pos, 5.5);
      g.player.lookAt(new THREE.Vector3(npc.pos.x, npc.pos.y + 1.2, npc.pos.z));
      this.foePos = npc.pos;
      this.refresh();
      for (const line of opts.intro || []) await this.say(`${npc.name}: ${line}`, 2400);
      await this.say(`${npc.name} wants to battle! (${this.foes.length} creatures)`, 1600);
      await this.sendOutFoe();
    }
    await this.placeAlly();
    await this.say(`Go, ${nameOf(this.ally)}!`, 900);

    let result = null;
    while (!result) result = await this.turn();

    // With a mouse, the browser only gives the mouse back to the game after a click, so end on a
    // button instead of making the player click through a pause screen.
    if (!g.isTouch()) {
      await this.choose([{ label: 'Continue exploring', value: true, cls: 'wide primary' }]);
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

  async turn() {
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
      await this.say(`Go, ${nameOf(this.ally)}!`, 900);
      return this.foeTurn();
    }

    // Both sides attack; priority moves first, then the faster creature.
    const foeMove = this.pickFoeMove();
    const allyFirst = (MOVES[action.move].priority || 0) - (MOVES[foeMove].priority || 0) ||
      statsFor(this.ally).spd - statsFor(this.foe).spd || Math.random() - 0.5;
    const order = allyFirst > 0
      ? [['ally', action.move], ['foe', foeMove]]
      : [['foe', foeMove], ['ally', action.move]];
    for (const [side, move] of order) {
      await this.useMove(side, move);
      if (this.foe.hp <= 0) return this.foeFainted();
      if (this.ally.hp <= 0) return this.allyFainted();
    }
    return null;
  }

  async foeTurn() {
    await this.useMove('foe', this.pickFoeMove());
    return this.ally.hp <= 0 ? this.allyFainted() : null;
  }

  pickFoeMove() {
    const moves = this.foe.moves;
    const allyType = SPECIES[this.ally.species].type;
    const good = moves.filter(m => effectiveness(MOVES[m].type, allyType) > 1);
    if (good.length && Math.random() < 0.5) return good[Math.floor(Math.random() * good.length)];
    return moves[Math.floor(Math.random() * moves.length)];
  }

  async useMove(side, moveId) {
    const atk = side === 'ally' ? this.ally : this.foe;
    const def = side === 'ally' ? this.foe : this.ally;
    const mv = MOVES[moveId];
    const who = side === 'foe' ? `${this.foeLabel} ${nameOf(atk)}` : nameOf(atk);
    this.say(`${who} used ${mv.name}!`, 700);
    await this.lunge(side);
    await wait(150);
    if (Math.random() > mv.acc) { sound.play('miss'); await this.say('But it missed!', 1000); return; }

    const as = statsFor(atk), ds = statsFor(def);
    const eff = effectiveness(mv.type, SPECIES[def.species].type);
    const stab = mv.type === SPECIES[atk.species].type ? 1.5 : 1;
    const crit = Math.random() < 1 / 16 ? 1.5 : 1;
    const base = Math.floor((((2 * atk.level) / 5 + 2) * mv.power * as.atk / ds.def) / 50) + 2;
    const dmg = Math.max(1, Math.floor(base * stab * eff * crit * (0.85 + Math.random() * 0.15)));
    def.hp = Math.max(0, def.hp - dmg);
    sound.play(eff > 1 ? 'super' : 'hit');
    this.flash(side === 'ally' ? 'foe' : 'ally');
    this.refresh();
    await wait(450);
    if (crit > 1) await this.say('A critical hit!', 900);
    if (eff === 0) await this.say(`It doesn't affect ${nameOf(def)}...`, 1100);
    else if (eff > 1) await this.say("It's super effective!", 1000);
    else if (eff < 1) await this.say("It's not very effective...", 1000);
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
    const xp = Math.floor((SPECIES[this.foe.species].baseXp * this.foe.level) / 5 * (this.trainer ? 1.5 : 1));
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
    const { msgs, evolved } = gainXp(this.ally, xp);
    this.refresh();
    for (const m of msgs) {
      if (m.includes(' grew to ')) sound.play('levelup');
      if (evolved && m.includes('evolved into')) { sound.play('evolve'); await this.evolveAnimation(); }
      await this.say(m, 1400);
    }
    const others = this.game.party.filter((c, i) => i !== this.allyIdx && c.hp > 0);
    if (!others.length) return;
    const share = Math.max(1, Math.floor(xp / 2));
    await this.say(`The rest of your team gained ${share} XP.`, 1000);
    for (const c of others) {
      for (const m of gainXp(c, share).msgs) {
        if (m.includes(' grew to ')) sound.play('levelup');
        await this.say(m, 1300);
      }
    }
  }

  async evolveAnimation() {
    const old = this.allyModel;
    for (let i = 0; i < 4; i++) {
      tintModel(old, 0xffffff); await wait(120);
      tintModel(old, null); await wait(120);
    }
    await this.placeAlly();
    this.refresh();
  }

  async allyFainted() {
    await this.faintModel(this.allyModel);
    await this.say(`${nameOf(this.ally)} fainted!`);
    if (!this.game.party.some(c => c.hp > 0)) {
      if (this.trainer) await this.say(`You lost to ${this.trainer.name}...`);
      await this.say('Your whole team is worn out...');
      await this.say('You hurry back to your starting point to rest.');
      return 'lost';
    }
    const idx = await this.pickPartyMember(false);
    this.allyIdx = idx;
    this.refresh();
    await this.placeAlly();
    await this.say(`Go, ${nameOf(this.ally)}!`, 900);
    return null;
  }

  async throwCube() {
    const g = this.game;
    const target = this.foeModel;
    const cube = makeCubeMesh();
    const from = g.player.eyePos.add(new THREE.Vector3(0, -0.3, 0));
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
    const p = Math.max(0.05, Math.min(0.95, SPECIES[this.foe.species].catchRate * hpFactor * levelFactor * 2.2));
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

