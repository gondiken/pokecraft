// Wave 19 stage C (plans/wave19-wizard-tower.md sections 7 and 8): the Wizard's battle, the drawing board and the ending. `createStudio(game, { startBattle,
// save })` -> `game.studio`: the save field `wizard` (won, ally, the painted palette, the design, rematch wins), talking to the Wizard (his gate words, the
// first battle, a rematch), what happens when a battle ends (`won` / `lost`, called from main.js onBattleEnd), the drawing board panel (six designs shown in
// YOUR painted colours; one tap and a question), the guardian that joins your team, the title "Wizard's Ally", and, once you are his ally, the Wizard and
// your guardian on his island in the Swirl (`update`). The battle is the ordinary boss battle (the last creature hangs on once, like Zenithar).
// Nothing here is a block; nothing is sent in play together (every friend has their own ending).
import * as THREE from 'three';
import { SPECIES, MOVES, nameOf, makeCreature, buildModel, animateModel, disposeModel, movesWith, MAX_LEVEL } from './species.js';
import { Fx } from './fx.js'; // owner 2026-11-09: the Attack Studio plays an attack in the turning picture
import { KIND_NAME, kindOf, RUSH } from './movekinds.js'; // owner 2026-11-10: each attack designed inside its kind
import { PREVIEW } from './comingsoon.js';
import { rematchMoves, rematchCubes } from './rematch.js';
import { sound } from './sound.js';
import { el } from './util.js';
import { PAINTS, DESIGNS, PAINT_SLOTS, guardianLevel } from './custom.js';
import { SLOTS, SLOT_LABELS, SLOT_ICONS, KIT, KIT_COLOURS, BARE, NAME_MAX, cleanDesign, kitName, randomName, flies, lookOf } from './guardiankit.js';
import { ABILITIES, CHOOSABLE, cleanChoice } from './abilities.js'; // chapter 3 step B: the guardian's chosen ability
import { abilityIcon } from './abilitychips.js';
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
  redesign: 'You beat me again! Want to give your guardian a new look? Talk to me.',
  newLook: name => `${name} has a new look!`,
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
export const KIT_SPECIES = 'guardian'; // owner 2026-11-08: your guardian is built from the part kit (guardiankit.js)

const isIndex = n => Number.isInteger(n) && n >= 0 && n < PAINTS.length;
export const cleanTriple = list => (Array.isArray(list) && list.length >= PAINT_SLOTS && list.slice(0, PAINT_SLOTS).every(isIndex) ? list.slice(0, PAINT_SLOTS) : null);

// The save field `wizard` -> the clean state (old saves have none = all empty). Only booleans, a clean paint triple, a known designed species and a whole
// number of rematch wins stay; an ally always has a design (junk that says ally without one is not an ally).
export function loadStudio(saved) {
  const s = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const design = typeof s.design === 'string' && (DESIGNS.includes(s.design) || s.design === KIT_SPECIES) && SPECIES[s.design]?.designed ? s.design : null;
  const ally = s.ally === true && design !== null;
  const wins = ally && Number.isInteger(s.wins) && s.wins > 0 ? Math.min(STUDIO.maxWins, s.wins) : 0;
  // look: the part-kit design (only for the kit guardian); redesign: one new look earned by a rematch win (owner 2026-11-08)
  const look = ally && design === KIT_SPECIES ? cleanDesign(s.look) : null;
  return { won: s.won === true || ally, ally, paint: cleanTriple(s.paint), design: ally ? design : null, look, redesign: ally && s.redesign === true, wins };
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
  let draft = null, tab = 'body', preview = null; // the drawing board: the design being drawn, the open part tab, the turning picture
  let atkMove = null; // owner 2026-11-10 (?preview): the attack picked on the board's Attacks tab
  const ATTACKS = 'attacks'; // the board's 9th tab (?preview)
  const ABILITY = 'ability'; // chapter 3 step B: the board's 8th tab, the one ability you choose (abilities.js; Fly comes from the parts)

  const dist = npc => (npc?.pos && game.player ? Math.hypot(game.player.pos.x - npc.pos.x, game.player.pos.z - npc.pos.z) : 0);
  const floor5 = () => game.beaten.includes(floorKey(5));
  const palette = () => S.paint ?? DEFAULT_GROUPS[5];
  const isWizard = npc => !!(npc?.def?.wizard || npc?.def?.allyWizard);
  const hasGuardian = () => !!S.design && [...game.party, ...game.box].some(c => c.species === S.design);
  const myGuardian = () => [...game.party, ...game.box].find(c => c.species === S.design) ?? null;

  const api = {
    // ---- state ----
    get won() { return S.won; }, set won(v) { S.won = !!v; },
    get ally() { return S.ally; }, set ally(v) { S.ally = !!v; },
    get paint() { return S.paint; }, set paint(v) { S.paint = cleanTriple(v); },
    get design() { return S.design; }, set design(v) { S.design = v; },
    get wins() { return S.wins; }, set wins(v) { S.wins = Math.max(0, v | 0); },
    load(saved) { Object.assign(S, loadStudio(saved)); pending = null; },
    get look() { return S.look; },
    get redesign() { return S.redesign; }, set redesign(v) { S.redesign = !!v && S.ally; },
    toSave() { return { won: S.won, ally: S.ally, paint: S.paint ? [...S.paint] : null, design: S.design, wins: S.wins, ...(S.look ? { look: cleanDesign(S.look) } : {}), ...(S.redesign ? { redesign: true } : {}) }; },
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
      if (S.redesign) { toast(`The Wizard: ${TALK.board}`); this.openBoard(); return; } // a rematch win earned one new look
      if (npc.def?.allyWizard) toast(`The Wizard: ${TALK.outside}`);
      this.offerRematch(npc);
    },
    talkPrompt(npc) {
      if (!isWizard(npc)) return null;
      if (S.ally && S.redesign) return { verb: 'give your guardian a new look', action: 'Draw!' };
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
      S.redesign = true; // owner 2026-11-08: a rematch win lets you redraw your guardian once
      toast(`The Wizard: ${TALK.redesign}`);
      save(true);
    },

    // ---- the drawing board ----
    // Opens the board once the battle screen is gone and nothing else is in the way (tries a few times).
    openBoardSoon(tries = 0) {
      const ready = game.started && !game.inBattle && !game.ui.panelOpen && !game.ui.asking;
      if (ready) { this.openBoard(); return; }
      if (tries < STUDIO.board.tries && (!S.ally || S.redesign)) setTimeout(() => this.openBoardSoon(tries + 1), STUDIO.board.retry * 1000);
    },
    openBoard() {
      if ((S.ally && !S.redesign) || !S.won || game.inBattle || !game.openBoard) return false;
      game.openBoard();
      return true;
    },
    get boardOpen() { return !!document.getElementById('drawboard') && !document.getElementById('drawboard').classList.contains('hidden'); },
    // ---- the part kit (owner 2026-11-08: "pick different parts of the body ... different colours on different parts") ----
    // The board: a turning picture of your guardian, seven part tabs (body first), each part's choices and its own colour, and a name.
    // The draft stays while the board is closed ("Not now"), so nothing a child drew is lost; it is saved only once chosen.
    startDraft() {
      if (draft) return draft;
      // the bare skeleton (owner 2026-11-08: no ready-made designs, body first) in the colours an old save painted on the old floor 5, else Blue / Pink / Yellow
      const [b, ac, be] = palette();
      draft = S.redesign && S.look ? cleanDesign(S.look) : { n: '', p: [...BARE.p], c: [b, b, ac, be, ac, ac, ac] };
      tab = 'body';
      return draft;
    },
    get draft() { return draft; },
    // Picks a part (slot, number) or a colour (slot, colour number) for the draft; the tests call these too.
    setPart(slot, i) { const k = SLOTS.indexOf(slot); if (!draft || k < 0 || !KIT[slot][i]) return false; draft.p[k] = i; tab = slot; this.refreshBoard(); return true; },
    setColour(slot, ci) { const k = SLOTS.indexOf(slot); if (!draft || k < 0 || !KIT_COLOURS[ci]) return false; draft.c[k] = ci; this.refreshBoard(); return true; },
    setTab(slot) { if (!SLOTS.includes(slot) && slot !== ABILITY && !(slot === ATTACKS && PREVIEW)) return false; tab = slot; this.refreshBoard(); document.querySelector('#drawboard .db-scroll')?.scrollTo?.(0, 0); if (slot === ATTACKS) this.playAttack(); return true; },
    // the one ability you choose for your guardian (null = none yet); kept in the draft as `ab`, saved with the design
    setAbility(id) { if (!draft || (id !== null && !cleanChoice(id))) return false; if (id) draft.ab = id; else delete draft.ab; tab = ABILITY; this.refreshBoard(); return true; },
    setName(n) { if (!draft) return false; draft.n = String(n ?? '').slice(0, NAME_MAX); return true; },
    shownName() { return draft ? (draft.n.trim() ? cleanDesign(draft).n : kitName(draft)) : ''; },
    // Fills #drawboard-body (ui.openPanel('drawboard')).
    renderBoard() {
      const body = document.getElementById('drawboard-body');
      if (!body) return;
      this.startDraft();
      const redo = S.ally && S.redesign;
      const nameIn = el('input', { id: 'db-name', type: 'text', maxlength: String(NAME_MAX), placeholder: kitName(draft), value: draft.n, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Name' });
      nameIn.addEventListener('input', () => { this.setName(nameIn.value); });
      nameIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') nameIn.blur(); });
      let rolls = (Date.now() / 1000) | 0;
      const dice = el('button', { id: 'db-dice', title: 'A silly name', onclick: () => { nameIn.value = randomName(rolls++); this.setName(nameIn.value); } }, '🎲');
      // owner 2026-11-10 ("hard to navigate, with scrolls, size"): the board fits the screen; only the choices scroll (.db-scroll),
      // the tabs and the Done button always stay in view
      body.replaceChildren(
        el('div', { class: 'db-head' }, el('h2', {}, redo ? '🖌️ A new look!' : '🖌️ You design it!'), el('p', { class: 'db-sub' }, 'Pick each part and its colour. Start with the body!')),
        el('div', { class: 'db-kit' },
          el('div', { class: 'db-left' },
            el('div', { id: 'db-preview' }),
            el('label', { class: 'db-namerow' }, el('span', {}, 'Name:'), nameIn, dice)),
          el('div', { class: 'db-right' },
            el('div', { id: 'db-tabs' }),
            el('div', { class: 'db-scroll' },
              el('div', { id: 'db-parts' }),
              el('div', { id: 'db-colours' })))),
        el('div', { class: 'db-foot' },
          el('button', { id: 'db-done', class: 'primary', onclick: () => this.done() }, redo ? '✅ New look!' : '✅ Done!'),
          redo && el('button', { id: 'db-rematch', onclick: () => this.rematchInstead() }, '⚔️ Rematch instead')));
      this.refreshBoard();
      this.startPreview();
    },
    // Redraws the tabs, the part buttons and the colour swatches (the picture and the name box stay).
    refreshBoard() {
      const tabs = document.getElementById('db-tabs');
      if (!tabs || !draft) { this.updatePreview(); return; }
      const nTabs = SLOTS.length + 1 + (PREVIEW ? 1 : 0);
      tabs.style.setProperty('--tabs', nTabs); tabs.style.setProperty('--tabs-narrow', Math.ceil(nTabs / 2));
      const chosen = ABILITIES[cleanChoice(draft.ab)];
      tabs.replaceChildren(...[...SLOTS.map((s, i) => el('button', { class: `db-tab${s === tab ? ' on' : ''}`, 'data-slot': s, onclick: () => this.setTab(s) },
        el('span', { class: 'db-ico' }, SLOT_ICONS[s]), el('span', {}, SLOT_LABELS[s]), el('small', {}, KIT[s][draft.p[i]].name))),
        el('button', { class: `db-tab${tab === ABILITY ? ' on' : ''}`, 'data-slot': ABILITY, onclick: () => this.setTab(ABILITY) },
          chosen ? abilityIcon(chosen.id, 26) : el('span', { class: 'db-ico' }, '🌟'), el('span', {}, 'Ability'), el('small', {}, chosen ? chosen.name : 'Pick one')),
        PREVIEW && el('button', { class: `db-tab${tab === ATTACKS ? ' on' : ''}`, 'data-slot': ATTACKS, onclick: () => this.setTab(ATTACKS) },
          el('span', { class: 'db-ico' }, '🎬'), el('span', {}, 'Attacks'), el('small', {}, `${this.attackMoves().length} moves`))].filter(Boolean));
      const sub = document.querySelector('#drawboard .db-sub');
      if (sub) sub.textContent = tab === ATTACKS ? 'Each attack is a kind. Design how it looks!' : tab === ABILITY ? 'Pick one thing your guardian can do!' : 'Pick each part and its colour. Start with the body!';
      if (tab === ATTACKS) { this.refreshAttacks(); this.updatePreview(); return; }
      if (tab === ABILITY) { this.refreshAbility(); this.updatePreview(); return; }
      const k = SLOTS.indexOf(tab), list = KIT[tab];
      document.getElementById('db-parts').replaceChildren(...list.map((part, i) => el('button', { class: `db-part${draft.p[k] === i ? ' on' : ''}`, 'data-part': String(i), onclick: () => this.setPart(tab, i) }, part.name)));
      const none = list[draft.p[k]].name === 'None';
      document.getElementById('db-colours').replaceChildren(
        el('span', { class: 'db-clabel' }, none ? `${SLOT_LABELS[tab]}: none` : `${SLOT_LABELS[tab]} colour:`),
        ...KIT_COLOURS.map((c, i) => el('button', { class: `db-swatch${draft.c[k] === i ? ' on' : ''}${c.rainbow ? ' rainbow' : ''}`, 'data-colour': String(i), title: c.name, disabled: none ? '' : undefined,
          style: c.rainbow ? '' : `background:#${c.hex.toString(16).padStart(6, '0')}`, onclick: () => this.setColour(tab, i) })));
      const nameIn = document.getElementById('db-name');
      if (nameIn) nameIn.placeholder = kitName(draft);
      this.updatePreview();
    },
    // The turning picture: its own little renderer (kept for the next time), a model rebuilt whenever the draft changes.
    startPreview() {
      const box = document.getElementById('db-preview');
      if (!box) return;
      if (!preview) {
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2, 4, 3); scene.add(sun);
        preview = { renderer, scene, cam: new THREE.PerspectiveCamera(32, 1, 0.1, 50), model: null, key: '', raf: 0, t: 0, last: 0 };
      }
      box.replaceChildren(preview.renderer.domElement);
      preview.renderer.setSize(260, 260, false);
      preview.key = '';
      this.updatePreview();
      cancelAnimationFrame(preview.raf);
      preview.last = performance.now();
      const loop = now => {
        if (!this.boardOpen || !preview) { this.stopPreview(); return; }
        const dt = Math.min(0.1, (now - preview.last) / 1000); preview.last = now; preview.t += dt;
        if (preview.model && tab !== ATTACKS) { preview.model.rotation.y = 0.5 + preview.t * 0.7; animateModel(preview.model, preview.t, false); }
        if (tab === ATTACKS) this.stepDemo(now);
        preview.renderer.render(preview.scene, preview.cam);
        preview.raf = requestAnimationFrame(loop);
      };
      preview.raf = requestAnimationFrame(loop);
    },
    updatePreview() {
      if (!preview || !draft) return;
      const demo = tab === ATTACKS, d = cleanDesign(draft), key = JSON.stringify([d.p, d.c, demo]);
      if (key === preview.key) return;
      preview.key = key;
      if (preview.model) { preview.scene.remove(preview.model); disposeModel(preview.model); }
      const m = buildModel(KIT_SPECIES, d);
      preview.scene.add(m);
      preview.model = m;
      if (preview.dummy) preview.dummy.visible = demo;
      if (demo) { this.stageDemo(m); return; }
      const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3());
      const size = Math.max(1.1, bb.getSize(new THREE.Vector3()).length() + (flies(d) ? 0.3 : 0));
      preview.cam.position.set(c.x + size * 0.4, c.y + size * 0.35, c.z + size * 1.75);
      preview.cam.lookAt(c.x, c.y, c.z);
      preview.renderer.render(preview.scene, preview.cam);
    },
    stopPreview() {
      if (!preview) return;
      cancelAnimationFrame(preview.raf);
      preview.fx?.clear(); preview.demo = null;
      if (preview.model) { preview.scene.remove(preview.model); disposeModel(preview.model); preview.model = null; }
      preview.key = '';
    },
    // ---- the Attacks tab (owner 2026-11-10: "the attack designer should be part of the custom design with wizard"; the kinds are
    //      chapter 3's: "Rush, shot, blast ... are the types of attacks"). Each attack of your guardian is a kind (movekinds.js, from the
    //      move's data); you design its animation inside that kind (shape, path, trail, size / pattern / ring, middle / move, hit, bits) and
    //      two colours. Kept in the draft (`a`: { moveId: { p, c } }) and saved with the design; a battle draws it (fx.attack, lookOf).
    attackMoves() {
      const c = S.redesign ? myGuardian() : null;
      const moves = c?.moves ?? makeCreature(KIT_SPECIES, guardianLevel(game.party, MAX_LEVEL)).moves;
      return moves.filter(id => kindOf(id)?.designable);
    },
    get atkMove() { const list = this.attackMoves(); if (!list.includes(atkMove)) atkMove = list[0] ?? null; return atkMove; },
    // the draft's look of one attack (made the first time it is opened: the kind's first choices in the guardian's body and extra colours)
    lookRaw(id) {
      if (!draft || !id || !MOVES[id]) return null;
      const kind = kindOf(id);
      draft.a ??= {};
      draft.a[id] = kind.cleanLook(draft.a[id] ?? kind.defaultLook([draft.c[0], draft.c[6]]));
      if (draft.a[id].c.length < 2) draft.a[id].c = [draft.c[0], draft.c[6]];
      return draft.a[id];
    },
    pickAttack(id) { if (!this.attackMoves().includes(id)) return false; atkMove = id; this.refreshBoard(); this.playAttack(); return true; },
    // a choice (slot index, choice number) or a colour (0 or 1, colour number) for the attack on the tab
    setChoice(si, i) {
      const id = this.atkMove, kind = id && kindOf(id), raw = this.lookRaw(id);
      if (!raw || !kind.slots[si]?.options[i]) return false;
      raw.p[si] = i; this.refreshBoard(); this.playAttack(); return true;
    },
    setAtkColour(n, ci) {
      const raw = this.lookRaw(this.atkMove);
      if (!raw || (n !== 0 && n !== 1) || !KIT_COLOURS[ci]) return false;
      raw.c[n] = ci; this.refreshBoard(); this.playAttack(); return true;
    },
    // The Ability tab: one chip per ability you can choose; Fly is never chosen (wings or a cloud give it).
    refreshAbility() {
      const parts = document.getElementById('db-parts'), cols = document.getElementById('db-colours');
      if (!parts || !cols) return;
      const pick = cleanChoice(draft.ab), fly = flies(draft);
      parts.replaceChildren(...CHOOSABLE.map(id => { const a = ABILITIES[id]; return el('button', { class: `db-part db-abil${pick === id ? ' on' : ''}`, 'data-ability': id, title: a.line, onclick: () => this.setAbility(id) },
        abilityIcon(id, 30), ` ${a.name}`); }));
      cols.replaceChildren(el('div', { class: 'db-abline' },
        pick ? el('p', {}, abilityIcon(pick, 30), el('b', {}, ` ${ABILITIES[pick].name}: `), ABILITIES[pick].line) : el('p', {}, 'Tap one to choose it.'),
        el('p', { class: 'db-fly' }, abilityIcon('fly', 30), fly ? ' It has wings, so it can fly too!' : ' Give it wings (Back) or a cloud (Legs) and it can fly too.')));
    },
    refreshAttacks() {
      const parts = document.getElementById('db-parts'), cols = document.getElementById('db-colours');
      if (!parts || !cols) return;
      const moves = this.attackMoves(), id = this.atkMove;
      if (!id) { parts.replaceChildren(el('p', { class: 'db-clabel' }, 'No attacks to design yet!')); cols.replaceChildren(); return; }
      const kind = kindOf(id), raw = this.lookRaw(id);
      const swatches = n => KIT_COLOURS.map((c, i) => el('button', { class: `db-swatch${raw.c[n] === i ? ' on' : ''}${c.rainbow ? ' rainbow' : ''}`, 'data-acolour': `${n}:${i}`, title: c.name,
        style: c.rainbow ? '' : `background:#${c.hex.toString(16).padStart(6, '0')}`, onclick: () => this.setAtkColour(n, i) }));
      parts.replaceChildren(
        el('div', { class: 'db-moves' }, ...moves.map(m => { const k = kindOf(m); return el('button', { class: `db-part db-move${m === id ? ' on' : ''}`, 'data-move': m, onclick: () => this.pickAttack(m) },
          el('b', {}, MOVES[m].name), el('small', {}, `${k.icon} ${KIND_NAME[k.id]}`)); })),
        el('div', { class: 'db-kindline' }, `${MOVES[id].name} is a `, el('b', {}, `${kind.icon} ${KIND_NAME[kind.id]}`), ' ', el('button', { class: 'db-play', title: 'Watch it', onclick: () => this.playAttack() }, '▶ Watch')),
        ...kind.slots.map((sl, si) => el('div', { class: 'db-slotrow', 'data-aslot': sl.id },
          el('span', { class: 'db-clabel' }, `${sl.icon} ${sl.label}:`),
          ...sl.options.map((o, i) => el('button', { class: `db-part db-opt${raw.p[si] === i ? ' on' : ''}${sl.options.length > 8 ? ' db-icon' : ''}`, 'data-opt': `${si}:${i}`, title: o.name, 'aria-label': o.name, onclick: () => this.setChoice(si, i) },
            el('span', { class: 'db-ico' }, o.icon), sl.options.length > 8 ? '' : ` ${o.name}`)))));
      cols.replaceChildren(el('div', { class: 'db-colrow' }, el('span', { class: 'db-clabel' }, '🎨 Colour 1:'), ...swatches(0)), el('div', { class: 'db-colrow' }, el('span', { class: 'db-clabel' }, '🎨 Colour 2:'), ...swatches(1)));
    },
    // The demo stage: the guardian on the left facing a practice target on the right, seen from the side.
    stageDemo(m) {
      if (!preview.dummy) {
        const g = new THREE.Group(), mat = hex => new THREE.MeshLambertMaterial({ color: hex });
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), mat(0x8a5a2b)); post.position.y = 0.35; g.add(post);
        [[0.5, 0xe13c3c], [0.36, 0xffffff], [0.22, 0xe13c3c], [0.09, 0xffffff]].forEach(([r, hex], i) => {
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08 + i * 0.012, 20), mat(hex));
          disc.rotation.z = Math.PI / 2; disc.position.set(0, 0.95, 0); g.add(disc);
        });
        preview.scene.add(g); preview.dummy = g;
      }
      preview.dummy.visible = true;
      const bb = new THREE.Box3().setFromObject(m), size = bb.getSize(new THREE.Vector3());
      const left = -0.7 - size.z / 2;
      m.position.set(left, 0, 0); m.rotation.y = Math.PI / 2; // faces +x, the target
      preview.home = left;
      preview.dummy.position.set(1.5, 0, 0); preview.dummy.rotation.set(0, -0.7, 0); preview.demoYaw = -0.7; // turned half to the camera
      const x0 = left - size.z / 2 - 0.45, x1 = 1.5 + 0.6, midX = (x0 + x1) / 2, h = Math.max(1.3, size.y);
      const dist = Math.max((x1 - x0) / 2, h * 0.7) / Math.tan(preview.cam.fov * Math.PI / 360) * 0.95; // both in view
      preview.cam.position.set(midX, h * 0.5 + dist * 0.45, dist); // a little from above: a big blast's ring on the ground shows
      preview.cam.lookAt(midX, h * 0.5, 0);
      preview.renderer.render(preview.scene, preview.cam);
    },
    spotOf(o) { const b = new THREE.Box3().setFromObject(o), pos = b.getCenter(new THREE.Vector3()); return { pos, top: b.max.y, r: Math.max(0.3, (b.max.x - b.min.x) / 2) }; },
    // Plays one attack in the preview: a Rush dashes over (like battle.js lunge), the rest hop forward a little; then the effect, then the target wobbles.
    playAttack(id = this.atkMove) {
      if (!preview || !draft || tab !== ATTACKS || !preview.model || !preview.dummy || !MOVES[id]) return false;
      this.lookRaw(id);
      preview.fx ??= new Fx(preview.scene, preview.cam);
      preview.fx.on = true;
      preview.fx.clear();
      const look = lookOf(cleanDesign(draft), id, MOVES[id]), lunge = look?.kind.lunge(look), rush = !!lunge?.far, now = performance.now();
      const gap = preview.dummy.position.x - preview.home;
      preview.model.position.x = preview.home;
      preview.demo = { id, look, t0: now, dash: rush ? RUSH.ms : 320, reach: rush ? Math.max(0.6, (gap - 0.9) * RUSH.reach) : 0.35, lunge, fired: false, hit: -1 };
      sound.play('fx:custom');
      return true;
    },
    stepDemo(now) {
      if (!preview?.model) return;
      animateModel(preview.model, preview.t, false);
      preview.fx?.update(now);
      const d = preview.demo;
      if (!d) return;
      const t = (now - d.t0) / d.dash, k = t < 1 ? Math.sin(Math.PI * t) : 0, L = d.lunge; // the same moves as battle.js lunge
      preview.model.position.set(preview.home + k * d.reach, k * (L?.hop ? 1.4 : 0.25), L?.zig && t < 1 ? Math.sin(t * 3 * Math.PI) * 0.6 : 0);
      preview.model.rotation.y = Math.PI / 2 + (L?.spin && t < 1 ? t * Math.PI * 4 : 0);
      if (t >= 1 && !d.fired) {
        d.fired = true;
        const from = this.spotOf(preview.model), to = this.spotOf(preview.dummy);
        preview.fx.attack(d.id, from, to, d.look).then(() => { if (preview?.demo === d) { d.hit = performance.now(); if (!d.look) preview.fx.impact('custom', to); sound.play('hit'); } });
      }
      const w = d.hit > 0 ? (now - d.hit) / 450 : -1;
      preview.dummy.rotation.z = w >= 0 && w < 1 ? Math.sin(w * 18) * 0.25 * (1 - w) : 0;
      preview.dummy.rotation.y = preview.demoYaw ?? 0;
      if (w >= 1) preview.demo = null;
    },
    done() {
      if (!draft || game.ui.asking) return false;
      const d = cleanDesign(draft), redo = S.ally && S.redesign;
      game.ui.ask({ text: redo ? `Give ${d.n} this new look?` : `Make ${d.n} your guardian?`, yes: 'Yes!', no: 'Not now', kind: 'mine', onYes: () => this.choose(d), onNo: () => {} });
      return true;
    },
    rematchInstead() {
      game.closeBoard?.();
      const npc = game.npcs?.list?.find(isWizard);
      if (npc) this.offerRematch(npc);
    },
    // Your guardian joins your team (the first time; chapter 2 ends), or your guardian gets its new look (after a rematch win).
    choose(design) {
      if (!design || typeof design !== 'object' || !S.won) return false;
      const d = cleanDesign(design);
      if (S.ally) return this.restyle(d);
      S.design = KIT_SPECIES; S.look = d; S.ally = true; S.wins = 0; S.redesign = false;
      const c = this.makeGuardian();
      const full = game.party.length >= 6;
      (full ? game.box : game.party).push(c);
      game.book.markCaught(KIT_SPECIES);
      game.cubes += STUDIO.cubes;
      draft = null;
      game.closeBoard?.();
      sound.play('champion');
      game.ui.celebrate(END.big, END.small(d.n), STUDIO.celebrateMs);
      if (full) toast(`${d.n} is waiting in your box.`);
      for (const m of END.toasts) toast(m);
      toast(`You got ${STUDIO.cubes} Capture Cubes!`);
      game.ui.renderHud?.();
      save(true);
      return true;
    },
    // A new look for the guardian you have (an old save's Brushtail & co. becomes a kit guardian; its level, moves and uid stay).
    restyle(d) {
      if (!S.redesign) return false;
      const c = myGuardian();
      S.design = KIT_SPECIES; S.look = d; S.redesign = false;
      if (c) { c.species = KIT_SPECIES; c.paint = cleanDesign(d); } else this.redraw();
      game.book.markCaught(KIT_SPECIES);
      draft = null;
      this.clearIsland();
      game.closeBoard?.();
      sound.play('champion');
      toast(`The Wizard: ${TALK.newLook(d.n)}`);
      game.ui.renderHud?.();
      save(true);
      return true;
    },
    makeGuardian() {
      const c = makeCreature(S.design, guardianLevel(game.party, MAX_LEVEL));
      c.paint = S.design === KIT_SPECIES ? cleanDesign(S.look) : [...palette()];
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
        model = buildModel(S.design, S.design === KIT_SPECIES ? S.look : palette());
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
      return { ...this.toSave(), draft: draft ? cleanDesign(draft) : null, tab, pending: !!pending, island: island ? { npc: !!island.npc, model: !!island.model, at: island.model ? island.model.position.toArray() : null } : null, boardOpen: this.boardOpen, hasGuardian: hasGuardian() };
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
