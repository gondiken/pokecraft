// Wave 19 stage C (plans/wave19-wizard-tower.md sections 7 and 8): the Wizard's battle, the drawing board and the ending. `createStudio(game, { startBattle,
// save })` -> `game.studio`: the save field `wizard` (won, ally, the painted palette, the design, rematch wins), talking to the Wizard (his gate words, the
// first battle, a rematch), what happens when a battle ends (`won` / `lost`, called from main.js onBattleEnd), the drawing board panel (six designs shown in
// YOUR painted colours; one tap and a question), the guardian that joins your team, the title "Wizard's Ally", and, once you are his ally, the Wizard and
// your guardian on his island in the Swirl (`update`). The battle is the ordinary boss battle (the last creature hangs on once, like Zenithar).
// Nothing here is a block; nothing is sent in play together (every friend has their own ending).
import * as THREE from 'three';
import { SPECIES, TYPE_COLORS, makeCreature, buildModel, animateModel, disposeModel, movesWith, MAX_LEVEL } from './species.js';
import { rematchMoves, rematchCubes } from './rematch.js';
import { sound } from './sound.js';
import { el } from './util.js';
import { portrait } from './ui.js';
import { PAINTS, DESIGNS, PAINT_SLOTS, guardianLevel } from './custom.js';
import { floorKey, WORDS, wizardTeam, DEFAULT_GROUPS, starCount, towerStand } from './wizardtower.js';
import { bridgeDone } from './pictureworlds.js';

export const STUDIO = { cubes: 20, xpBoost: 1.5, askTime: 20, askRange: 8, maxWins: 999, celebrateMs: 10000, board: { retry: 0.5, tries: 20 } };

// What the Wizard says (kid-sized).
export const TALK = {
  intro: ['So you are the one who brought my stars back.', 'Holding the Swirl together made me so tired...', 'Show me your team. Then I will ask you something big.'],
  lose: 'What a team! You are strong enough.',
  win: 'A good try! Rest, train, and come back up.',
  rematchIntro: ['Back again, my ally? My team has been practising too!'],
  rematchWin: 'Wow, you beat me again!',
  board: 'You design it!',
  redrawn: 'Oh! Your guardian was missing. I drew it again for you.',
  outside: "I'm out! The air is lovely.",
  declined: 'OK! Come back any time.',
};
export const END = {
  big: "🧙 You are the Wizard's Ally!",
  small: name => `${name} guards the Swirl now. The crack is closed!`,
  toasts: ['Look! The crack in the Swirl is closing!', 'I can finally come out of my tower. Thank you, my ally!',
    'Something scribbly is still out there... I will need your help again.', 'Rematch me any time!'],
};
export const RANK = "🧙 Wizard's Ally";

const isIndex = n => Number.isInteger(n) && n >= 0 && n < PAINTS.length;
export const cleanTriple = list => (Array.isArray(list) && list.length >= PAINT_SLOTS && list.slice(0, PAINT_SLOTS).every(isIndex) ? list.slice(0, PAINT_SLOTS) : null);

// The save field `wizard` -> the clean state (old saves have none = all empty). Only booleans, a clean paint triple, a known designed species and a whole
// number of rematch wins stay; an ally always has a design (junk that says ally without one is not an ally).
export function loadStudio(saved) {
  const s = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const design = typeof s.design === 'string' && DESIGNS.includes(s.design) && SPECIES[s.design]?.designed ? s.design : null;
  const ally = s.ally === true && design !== null;
  const wins = ally && Number.isInteger(s.wins) && s.wins > 0 ? Math.min(STUDIO.maxWins, s.wins) : 0;
  return { won: s.won === true || ally, ally, paint: cleanTriple(s.paint), design: ally ? design : null, wins };
}

// The Wizard's team for a battle: [[species, level, moves]] (pure). `wins` = null for the first battle, else the rematch wins so far (+5 levels each,
// from the third rematch a big move too, like the gym rematches).
export function battleTeam(wins = null) {
  const w = wins ?? 0;
  return wizardTeam(w).map(m => {
    const base = movesWith(m.species, m.level, ...m.extra);
    return [m.species, m.level, rematchMoves(null, w + 1, m.species, m.level, base)];
  });
}
export const topLevel = team => Math.max(...team.map(t => t[1]));

export function createStudio(game, { startBattle, save }) {
  const toast = m => game.ui.toast(m);
  const S = { ...loadStudio(null) };
  let pending = null;          // a rematch question that is showing
  let island = null;           // the Swirl's Wizard and guardian of the world they were made for
  let clock = 0;

  const dist = npc => (npc?.pos && game.player ? Math.hypot(game.player.pos.x - npc.pos.x, game.player.pos.z - npc.pos.z) : 0);
  const floor5 = () => game.beaten.includes(floorKey(5));
  const palette = () => S.paint ?? DEFAULT_GROUPS[5];
  const isWizard = npc => !!(npc?.def?.wizard || npc?.def?.allyWizard);
  const hasGuardian = () => !!S.design && [...game.party, ...game.box].some(c => c.species === S.design);
  const canvas = id => `${SPECIES[id].name}`;

  const api = {
    // ---- state ----
    get won() { return S.won; }, set won(v) { S.won = !!v; },
    get ally() { return S.ally; }, set ally(v) { S.ally = !!v; },
    get paint() { return S.paint; }, set paint(v) { S.paint = cleanTriple(v); },
    get design() { return S.design; }, set design(v) { S.design = v; },
    get wins() { return S.wins; }, set wins(v) { S.wins = Math.max(0, v | 0); },
    load(saved) { Object.assign(S, loadStudio(saved)); pending = null; },
    toSave() { return { won: S.won, ally: S.ally, paint: S.paint ? [...S.paint] : null, design: S.design, wins: S.wins }; },
    rank() { return S.ally ? RANK : null; },
    // the pause screen's / Book's title line: Champion and Wizard's Ally together
    rankText() { return [game.champion ? '🏆 Champion' : null, S.ally ? RANK : null].filter(Boolean).join(' · '); },
    team() { return battleTeam(S.ally ? S.wins : null); },

    // ---- talking ----
    // The Wizard (in the tower or on his island): returns true when it was him.
    talk(npc) {
      if (!isWizard(npc)) return false;
      if (S.ally) { this.talkAlly(npc); return true; }
      if (!floor5()) { toast(`The Wizard: ${WORDS.wizardGate5}`); return true; }
      if (!bridgeDone(game.stars)) { toast(`The Wizard: ${WORDS.wizardGateStars(starCount(game.stars))}`); return true; }
      if (S.won) { toast(`The Wizard: ${TALK.board}`); this.openBoard(); return true; } // the win is kept: until you chose, he hands you the board again
      startBattle({ trainer: npc, team: this.team(), intro: TALK.intro, boss: true, xpBoost: STUDIO.xpBoost, wizard: { rematch: null } });
      return true;
    },
    talkAlly(npc) {
      if (!hasGuardian()) this.redraw();
      if (npc.def?.allyWizard) toast(`The Wizard: ${TALK.outside}`);
      this.offerRematch(npc);
    },
    talkPrompt(npc) {
      if (!isWizard(npc)) return null;
      if (S.ally) return { verb: 'ask for a rematch', action: 'Rematch!' };
      if (S.won) return { verb: 'design your guardian', action: 'Draw!' };
      return { verb: 'challenge', action: 'Battle!' };
    },
    offerRematch(npc) {
      if (game.ui.asking || game.inBattle) return false;
      const team = this.team(), top = topLevel(team), n = S.wins;
      pending = { npc, at: performance.now() };
      game.ui.ask({
        text: n === 0 ? `The Wizard: A rematch? My team is up to level ${top} now!`
          : `The Wizard: Rematch number ${n + 1}? You beat me ${n} ${n === 1 ? 'time' : 'times'}! My team is up to level ${top} now.`,
        yes: 'Battle!', no: 'Not now', kind: 'mine',
        onYes: () => this.acceptRematch(npc),
        onNo: () => { pending = null; toast(`The Wizard: ${TALK.declined}`); },
      });
      return true;
    },
    acceptRematch(npc = pending?.npc) {
      pending = null;
      game.ui.closeAsk();
      if (!npc || game.inBattle || dist(npc) > STUDIO.askRange) return;
      startBattle({ trainer: npc, team: this.team(), intro: TALK.rematchIntro, boss: true, xpBoost: STUDIO.xpBoost, wizard: { rematch: S.wins } });
    },

    // ---- a battle ends (main.js onBattleEnd) ----
    battleLost() { toast(`The Wizard: ${TALK.win}`); },
    battleWon(npc, opts) {
      const rematch = opts?.wizard?.rematch;
      if (rematch == null || !S.ally) { // the first win: his hand-over
        if (S.ally) return;
        S.won = true;
        sound.play('champion');
        toast(`The Wizard: ${TALK.lose}`);
        toast(`The Wizard: ${TALK.board}`);
        save(true);
        this.openBoardSoon();
        return;
      }
      S.wins = Math.min(STUDIO.maxWins, S.wins + 1);
      const c = rematchCubes(S.wins);
      game.cubes += c;
      sound.play('win');
      toast(`The Wizard: ${TALK.rematchWin}`);
      const capped = this.team().every(t => t[1] >= MAX_LEVEL);
      toast(`Rematch win ${S.wins}! +${c} Capture Cubes. ${capped ? "My team can't get any stronger. You are the best!" : 'Next time my team will be even stronger!'}`);
      save(true);
    },

    // ---- the drawing board ----
    // Opens the board once the battle screen is gone and nothing else is in the way (tries a few times).
    openBoardSoon(tries = 0) {
      const ready = game.started && !game.inBattle && !game.ui.panelOpen && !game.ui.asking;
      if (ready) { this.openBoard(); return; }
      if (tries < STUDIO.board.tries && !S.ally) setTimeout(() => this.openBoardSoon(tries + 1), STUDIO.board.retry * 1000);
    },
    openBoard() {
      if (S.ally || !S.won || game.inBattle || !game.openBoard) return false;
      game.openBoard();
      return true;
    },
    get boardOpen() { return !!document.getElementById('drawboard') && !document.getElementById('drawboard').classList.contains('hidden'); },
    // Fills #drawboard-body (ui.openPanel('drawboard')): six cards, each a portrait of a design in YOUR painted colours.
    renderBoard() {
      const body = document.getElementById('drawboard-body');
      if (!body) return;
      const paint = palette();
      body.replaceChildren(
        el('h2', {}, '🖌️ You design it!'),
        el('p', { class: 'db-sub' }, 'Tap the guardian you want. It will wear your colours!'),
        el('div', { class: 'db-grid' }, ...DESIGNS.map(id => {
          const sp = SPECIES[id];
          const chips = [sp.type, SECOND[id]];
          return el('button', { class: 'db-card', 'data-design': id, onclick: () => this.pick(id) },
            el('img', { src: portrait(id, 150, 128, false, paint), width: 150, height: 128, alt: sp.name }),
            el('b', {}, sp.name),
            el('span', { class: 'db-types' }, ...chips.map(t => el('span', { class: 'type', style: `background:${TYPE_COLORS[t]}` }, t))),
            el('small', {}, sp.desc));
        })));
    },
    pick(id) {
      if (S.ally || !SPECIES[id]?.designed) return false;
      game.ui.ask({ text: `Make ${SPECIES[id].name} your guardian?`, yes: 'Yes!', no: 'Not now', kind: 'mine', onYes: () => this.choose(id), onNo: () => {} });
      return true;
    },
    // The guardian joins your team in your colours; chapter 2 ends.
    choose(id) {
      if (S.ally || !S.won || !SPECIES[id]?.designed) return false;
      S.paint = cleanTriple(S.paint) ?? [...DEFAULT_GROUPS[5]];
      S.design = id; S.ally = true; S.wins = 0;
      const c = this.makeGuardian();
      const full = game.party.length >= 6;
      (full ? game.box : game.party).push(c);
      game.book.markCaught(id);
      game.cubes += STUDIO.cubes;
      game.closeBoard?.();
      sound.play('champion');
      game.ui.celebrate(END.big, END.small(SPECIES[id].name), STUDIO.celebrateMs);
      if (full) toast(`${canvas(id)} is waiting in your box.`);
      for (const m of END.toasts) toast(m);
      toast(`You got ${STUDIO.cubes} Capture Cubes!`);
      game.ui.renderHud?.();
      save(true);
      return true;
    },
    makeGuardian() {
      const c = makeCreature(S.design, guardianLevel(game.party, MAX_LEVEL));
      c.paint = [...palette()];
      return c;
    },
    // A guardian that is missing (a bug, an old device): the Wizard draws it again from the save.
    redraw() {
      if (!S.ally || !S.design || hasGuardian()) return false;
      const c = this.makeGuardian();
      (game.party.length >= 6 ? game.box : game.party).push(c);
      game.book.markCaught(S.design);
      toast(`The Wizard: ${TALK.redrawn}`);
      save(true);
      return true;
    },

    // ---- the Swirl afterwards: the Wizard on his island, your guardian circling his tower ----
    update(dt) {
      clock += dt;
      if (pending) {
        if (!game.ui.asking) pending = null;
        else if (performance.now() - pending.at > STUDIO.askTime * 1000 || dist(pending.npc) > STUDIO.askRange) { game.ui.askNo(); pending = null; }
      }
      const w = game.world, wz = S.ally && game.place === 'swirl' ? w?.swirl?.wizard : null;
      if (island && (island.world !== w || !wz)) this.clearIsland();
      if (!wz || island || !game.scene || !game.started) return;
      this.buildIsland(w, wz);
    },
    buildIsland(w, wz) {
      const s = towerStand(w);
      let npc = null;
      if (s && game.npcs?.addGuest) {
        npc = game.npcs.list.find(n => n.def?.allyWizard) ?? game.npcs.addGuest({ name: 'The Wizard', title: 'The Wizard · his island', colors: { skin: 0xf2c9a0, hair: 0xf4f0ea, shirt: 0x6a3ab8, pants: 0x4a2a90 },
          look: 'wizard', line: TALK.outside, allyWizard: true, pos: [s[0] - 0.5, s[1], s[2]], heading: -Math.PI / 2 });
      }
      let model = null;
      if (S.design && SPECIES[S.design]) {
        model = buildModel(S.design, palette());
        model.scale.setScalar(2.4);
        game.scene.add(model);
      }
      island = { world: w, wz, npc, model, t: 0 };
    },
    clearIsland() {
      if (island?.model) { game.scene.remove(island.model); disposeModel(island.model); }
      island = null;
    },
    // after the Wizard's person moved with the manager's list (a world change rebuilds the list): the manager drops it itself
    info() {
      return { ...this.toSave(), pending: !!pending, island: island ? { npc: !!island.npc, model: !!island.model, at: island.model ? island.model.position.toArray() : null } : null, boardOpen: this.boardOpen, hasGuardian: hasGuardian() };
    },
  };

  // The guardian circles slowly round the top of his tower.
  const orbit = dt => {
    if (!island?.model) return;
    island.t += dt;
    const { x, z } = island.wz, a = island.t * 0.28;
    island.model.position.set(x + 0.5 + Math.cos(a) * 8, 41 + Math.sin(island.t * 0.9) * 0.6, z + 0.5 + Math.sin(a) * 8);
    island.model.rotation.y = -a;
    animateModel(island.model, island.t, true);
  };
  const baseUpdate = api.update;
  api.update = function (dt) { baseUpdate.call(api, dt); orbit(dt); };
  game.studio = api;
  return api;
}

// A design's second type (custom.js / species.js: `L('custom', second)`; the plan's table in section 8.1).
const SECOND = { brushtail: 'pixie', palettoad: 'water', inkwing: 'sky', crayonix: 'drake', framesaur: 'rock', blotbun: 'slime' };
