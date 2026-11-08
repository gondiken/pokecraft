// Wave 19 stage C (plans/wave19-wizard-tower.md sections 7 and 8): the Wizard's battle, the drawing board and the ending. `createStudio(game, { startBattle,
// save })` -> `game.studio`: the save field `wizard` (won, ally, the painted palette, the design, rematch wins), talking to the Wizard (his gate words, the
// first battle, a rematch), what happens when a battle ends (`won` / `lost`, called from main.js onBattleEnd), the drawing board panel (six designs shown in
// YOUR painted colours; one tap and a question), the guardian that joins your team, the title "Wizard's Ally", and, once you are his ally, the Wizard and
// your guardian on his island in the Swirl (`update`). The battle is the ordinary boss battle (the last creature hangs on once, like Zenithar).
// Nothing here is a block; nothing is sent in play together (every friend has their own ending).
import * as THREE from 'three';
import { SPECIES, makeCreature, buildModel, animateModel, disposeModel, movesWith, MAX_LEVEL } from './species.js';
import { rematchMoves, rematchCubes } from './rematch.js';
import { sound } from './sound.js';
import { el } from './util.js';
import { PAINTS, DESIGNS, PAINT_SLOTS, guardianLevel } from './custom.js';
import { SLOTS, SLOT_LABELS, SLOT_ICONS, KIT, KIT_COLOURS, BARE, NAME_MAX, cleanDesign, kitName, randomName, flies } from './guardiankit.js';
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
      // the bare skeleton (owner 2026-11-08: no ready-made designs, body first) in the colours you painted on floor 5 (its sign promises them)
      const [b, ac, be] = palette();
      draft = S.redesign && S.look ? cleanDesign(S.look) : { n: '', p: [...BARE.p], c: [b, b, ac, be, ac, ac, ac] };
      tab = 'body';
      return draft;
    },
    get draft() { return draft; },
    // Picks a part (slot, number) or a colour (slot, colour number) for the draft; the tests call these too.
    setPart(slot, i) { const k = SLOTS.indexOf(slot); if (!draft || k < 0 || !KIT[slot][i]) return false; draft.p[k] = i; tab = slot; this.refreshBoard(); return true; },
    setColour(slot, ci) { const k = SLOTS.indexOf(slot); if (!draft || k < 0 || !KIT_COLOURS[ci]) return false; draft.c[k] = ci; this.refreshBoard(); return true; },
    setTab(slot) { if (!SLOTS.includes(slot)) return false; tab = slot; this.refreshBoard(); return true; },
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
      body.replaceChildren(
        el('h2', {}, redo ? '🖌️ A new look!' : '🖌️ You design it!'),
        el('p', { class: 'db-sub' }, 'Pick each part and its colour. Start with the body!'),
        el('div', { class: 'db-kit' },
          el('div', { class: 'db-left' },
            el('div', { id: 'db-preview' }),
            el('label', { class: 'db-namerow' }, el('span', {}, 'Name:'), nameIn, dice)),
          el('div', { class: 'db-right' },
            el('div', { id: 'db-tabs' }),
            el('div', { id: 'db-parts' }),
            el('div', { id: 'db-colours' }))),
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
      const k = SLOTS.indexOf(tab), list = KIT[tab];
      tabs.replaceChildren(...SLOTS.map((s, i) => el('button', { class: `db-tab${s === tab ? ' on' : ''}`, 'data-slot': s, onclick: () => this.setTab(s) },
        el('span', { class: 'db-ico' }, SLOT_ICONS[s]), el('span', {}, SLOT_LABELS[s]), el('small', {}, KIT[s][draft.p[i]].name))));
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
        if (preview.model) { preview.model.rotation.y = 0.5 + preview.t * 0.7; animateModel(preview.model, preview.t, false); }
        preview.renderer.render(preview.scene, preview.cam);
        preview.raf = requestAnimationFrame(loop);
      };
      preview.raf = requestAnimationFrame(loop);
    },
    updatePreview() {
      if (!preview || !draft) return;
      const d = cleanDesign(draft), key = JSON.stringify([d.p, d.c]);
      if (key === preview.key) return;
      preview.key = key;
      if (preview.model) { preview.scene.remove(preview.model); disposeModel(preview.model); }
      const m = buildModel(KIT_SPECIES, d);
      preview.scene.add(m);
      preview.model = m;
      const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3());
      const size = Math.max(1.1, bb.getSize(new THREE.Vector3()).length() + (flies(d) ? 0.3 : 0));
      preview.cam.position.set(c.x + size * 0.4, c.y + size * 0.35, c.z + size * 1.75);
      preview.cam.lookAt(c.x, c.y, c.z);
      preview.renderer.render(preview.scene, preview.cam);
    },
    stopPreview() {
      if (!preview) return;
      cancelAnimationFrame(preview.raf);
      if (preview.model) { preview.scene.remove(preview.model); disposeModel(preview.model); preview.model = null; }
      preview.key = '';
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
