// HUD, toasts, team screen and creature portraits.
import * as THREE from 'three';
import { BLOCKS, PLACEABLE, drawBlockIcon } from './blocks.js';
import { SPECIES, MOVES, TYPE_COLORS, statsFor, nameOf, xpForLevel, buildModel, disposeModel } from './species.js';
import { hpColor, el } from './util.js';
import { GYMS } from './gyms.js';
import { typeLink } from './book.js';

const BOX_SORT_KEY = 'pokecraft-box-sort';
const BOX_SORTS = [['newest', 'Newest'], ['level', 'Level'], ['name', 'Name'], ['type', 'Type']];
const TYPE_ORDER = Object.keys(TYPE_COLORS);

let portraitRenderer = null;
const portraitCache = new Map();

// Renders a creature model to a small image (cached per species).
export function portrait(species, w = 140, h = 120, silhouette = false) {
  const key = `${species}:${w}x${h}${silhouette ? ':s' : ''}`;
  if (portraitCache.has(key)) return portraitCache.get(key);
  if (!portraitRenderer) {
    portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  }
  portraitRenderer.setSize(w, h, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const model = buildModel(species);
  if (silhouette) model.traverse(o => { if (o.isMesh) { o.material.dispose(); o.material = new THREE.MeshBasicMaterial({ color: 0x0d0f16 }); } });
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const cam = new THREE.PerspectiveCamera(35, w / h, 0.1, 50);
  cam.position.set(center.x + size * 0.95, center.y + size * 0.5, center.z + size * 1.45);
  cam.lookAt(center);
  portraitRenderer.render(scene, cam);
  const url = portraitRenderer.domElement.toDataURL();
  disposeModel(model);
  portraitCache.set(key, url);
  return url;
}

export class UI {
  constructor(game, atlas) {
    this.game = game;
    this.atlas = atlas;
    this.hotbar = document.getElementById('hotbar');
    this.cubes = document.getElementById('cubes');
    this.partyMini = document.getElementById('party-mini');
    this.toastBox = document.getElementById('toast');
    this.promptEl = document.getElementById('prompt');
    this.clock = document.getElementById('clock');
    this.guide = document.getElementById('guide');
    this.keyCompass = document.getElementById('key-compass');
    this.badgeRow = document.getElementById('badges');
    this.titleEl = el('div', { id: 'champion-title', class: 'hidden' }, '★ Champion ★');
    this.badgeRow.after(this.titleEl);
    this.partyPanel = document.getElementById('party');
    this.blocksPanel = document.getElementById('blocks');
    this.bookPanel = document.getElementById('book');
    this.homePanel = document.getElementById('home'); // T22
    this.slots = [];
    // Storage box view: the sort is remembered on this device, the type filter is not.
    // Both are only for showing: game.box keeps its order, so saves don't change.
    this.boxSort = 'newest';
    try { const v = localStorage.getItem(BOX_SORT_KEY); if (BOX_SORTS.some(([k]) => k === v)) this.boxSort = v; } catch { /* ignore */ }
    this.boxType = 'all';
    this.confirmBox = document.getElementById('box-confirm');
    document.getElementById('box-confirm-no').addEventListener('click', e => { e.stopPropagation(); this.closeConfirm(); });
    document.getElementById('box-confirm-yes').addEventListener('click', e => { e.stopPropagation(); this.confirmYes?.(); });
  }

  // The hotbar shows game.hotbar. Tapping the selected slot again opens the Blocks panel.
  buildHotbar() {
    const g = this.game;
    this.hotbarKey = g.hotbar.join();
    this.slots = g.hotbar.map((id, i) => el('div', {
      class: 'slot', title: BLOCKS[id].name,
      onpointerdown: e => {
        e.preventDefault();
        if (g.selected === i && g.started && !g.inBattle) g.openBlocks?.();
        else { g.selected = i; this.renderHud(); }
      },
    }, drawBlockIcon(this.atlas, id), el('span', {}, i + 1), BLOCKS[id].limited ? el('b', { class: 'count' }) : ''));
    this.hotbar.replaceChildren(...this.slots);
  }

  renderBlocks() {
    const g = this.game;
    document.getElementById('blocks-slot').textContent = g.selected + 1;
    // Limited blocks (T20 treasure) show how many you have ("Ruby ×3") and are greyed out at 0.
    document.getElementById('block-list').replaceChildren(...PLACEABLE.map(id => {
      const def = BLOCKS[id], n = g.blockCounts[id] || 0;
      return el('button', {
        class: `${id === g.hotbar[g.selected] ? 'sel' : ''}${def.limited && !n ? ' empty' : ''}`, title: def.name,
        onclick: () => { g.hotbar[g.selected] = id; this.renderHud(); g.closeBlocks?.(); },
      }, drawBlockIcon(this.atlas, id), def.limited ? `${def.name} ×${n}` : def.name);
    }));
  }

  renderHud() {
    const g = this.game;
    if (this.hotbarKey !== g.hotbar.join()) this.buildHotbar();
    this.slots.forEach((s, i) => {
      s.classList.toggle('sel', i === g.selected);
      const count = s.querySelector('.count');
      if (!count) return;
      const n = g.blockCounts[g.hotbar[i]] || 0;
      count.textContent = `×${n}`;
      s.classList.toggle('empty', !n);
    });
    this.cubes.textContent = `Capture Cubes: ${g.cubes}`;
    const key = g.badges.join();
    if (this.badgeKey !== key) {
      this.badgeKey = key;
      this.badgeRow.replaceChildren(...GYMS.map(gym => this.badgeIcon(gym, g.badges.includes(gym.id))));
    }
    this.titleEl.classList.toggle('hidden', !g.champion);
    this.partyMini.replaceChildren(...g.party.map((c, i) => {
      const st = statsFor(c);
      const frac = c.hp / st.maxHp;
      return el('div', { class: `mini${i === 0 ? ' lead' : ''}` },
        el('div', { class: 'row' }, el('span', {}, nameOf(c)), el('span', {}, `Lv${c.level}`)),
        el('div', { class: 'hpbar' }, el('div', { style: `width:${frac * 100}%;background:${hpColor(frac)}` })));
    }));
  }

  setPrompt(text) {
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
  }

  badgeIcon(gym, got) {
    return el('div', {
      class: `badge${got ? ' got' : ''}`, title: got ? gym.badge : `${gym.badge} (not earned yet)`,
      style: got ? `background:${TYPE_COLORS[gym.type]}` : '',
    });
  }

  // Confetti and a big message when the player becomes Champion.
  celebrate() {
    document.getElementById('celebrate')?.remove();
    const colors = ['#ff5a5a', '#ffa23a', '#ffd84a', '#5ad85a', '#4aa8ff', '#a06aff'];
    const confetti = Array.from({ length: 40 }, () => el('span', {
      style: `left:${Math.random() * 100}%;animation-delay:${(Math.random() * 3).toFixed(2)}s;background:${colors[Math.floor(Math.random() * colors.length)]}`,
    }));
    const box = el('div', { id: 'celebrate' },
      el('div', { class: 'big' }, 'You are the Champion!'),
      el('div', { class: 'small' }, 'Your team is the best in the world!'),
      ...confetti);
    document.body.append(box);
    setTimeout(() => box.remove(), 7000);
  }

  setGuide(text) {
    if (this.guide.textContent !== text) this.guide.textContent = text;
  }

  // T23 key compass: null hides it; otherwise { period, found } (seconds per glint, keys found so far).
  setKeyCompass(state) {
    const c = this.keyCompass;
    if (!c) return;
    if (!state) { if (this.keyShown !== null) { c.classList.add('hidden'); this.keyShown = null; } return; }
    const tag = `${Math.round(state.period * 10)}/${state.found}`;
    if (tag === this.keyShown) return;
    this.keyShown = tag;
    c.classList.remove('hidden');
    c.style.setProperty('--glint', `${(Math.round(state.period * 10) / 10).toFixed(1)}s`);
    c.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('got', i < state.found));
  }

  setClock(text) {
    if (this.clock.textContent !== text) this.clock.textContent = text;
  }

  toast(msg) {
    const d = el('div', {}, msg);
    this.toastBox.append(d);
    setTimeout(() => d.remove(), 3000);
  }

  monCard(c, i, inParty) {
    const g = this.game;
    const sp = SPECIES[c.species];
    const st = statsFor(c);
    const frac = c.hp / st.maxHp;
    const xpFrac = (c.xp - xpForLevel(c.level)) / (xpForLevel(c.level + 1) - xpForLevel(c.level));
    const btns = [];
    if (inParty) {
      if (i > 0) btns.push(el('button', { onclick: () => { g.party.unshift(...g.party.splice(i, 1)); this.refreshPanel(); } }, 'Make lead'));
      if (g.party.length > 1) btns.push(el('button', { onclick: () => { g.box.push(...g.party.splice(i, 1)); this.refreshPanel(); } }, 'To box'));
    } else {
      // i is the real index in game.box (the box view may be sorted or filtered).
      if (g.party.length < 6) btns.push(el('button', { onclick: () => { g.party.push(...g.box.splice(i, 1)); this.refreshPanel(); } }, 'To team'));
      btns.push(el('button', { class: 'letgo', onclick: () => this.askLetGo(c) }, 'Let go'));
    }
    return el('div', { class: `mon${inParty && i === 0 ? ' lead' : ''}` },
      el('div', { class: 'top' },
        el('button', { class: 'wlink pic', 'data-species': c.species, title: `${sp.name} in the Creature Book`, onclick: () => this.openBook({ species: c.species }) },
          el('img', { src: portrait(c.species, 70, 60), width: 70, height: 60, alt: sp.name })),
        el('div', { style: 'flex:1;margin-left:8px' },
          el('button', { class: 'wlink nm', 'data-species': c.species, onclick: () => this.openBook({ species: c.species }) }, sp.name),
          el('div', {}, typeLink(sp.type, t => this.openBook({ type: t })), ` Lv${c.level}`))),
      el('div', {}, `HP ${c.hp}/${st.maxHp} · ATK ${st.atk} · DEF ${st.def} · SPD ${st.spd}`),
      el('div', { class: 'hpbar' }, el('div', { style: `width:${frac * 100}%;background:${hpColor(frac)}` })),
      el('div', { class: 'xpbar' }, el('div', { style: `width:${Math.max(0, Math.min(1, xpFrac)) * 100}%` })),
      el('div', { class: 'moves' }, ...c.moves.map(m => el('button', { 'data-move': m, style: `background:${TYPE_COLORS[MOVES[m].type]}`, onclick: () => this.openBook({ move: m }) }, MOVES[m].name))),
      btns.length > 0 && el('div', { class: 'btns' }, ...btns));
  }

  refreshPanel() {
    const g = this.game;
    document.getElementById('badge-list').replaceChildren(...GYMS.map(gym => {
      const got = g.badges.includes(gym.id);
      return el('div', { class: `badge-card${got ? '' : ' missing'}` }, this.badgeIcon(gym, got),
        got ? gym.badge : `${gym.name} (${gym.type})`);
    }));
    document.getElementById('party-list').replaceChildren(...g.party.map((c, i) => this.monCard(c, i, true)));
    this.renderBox();
    this.renderHud();
  }

  // The storage box: sort buttons, type chips (only types in the box, with a count) and the cards.
  renderBox() {
    const g = this.game;
    const counts = {};
    for (const c of g.box) { const ty = SPECIES[c.species].type; counts[ty] = (counts[ty] || 0) + 1; }
    if (this.boxType !== 'all' && !counts[this.boxType]) this.boxType = 'all';
    document.getElementById('box-title').textContent = g.box.length ? `Storage Box (${g.box.length})` : 'Storage Box';
    const tools = document.getElementById('box-tools');
    if (g.box.length > 1) {
      const sortBtn = ([key, label]) => el('button', {
        class: key === this.boxSort ? 'sel' : '', 'data-sort': key,
        onclick: () => {
          this.boxSort = key;
          try { localStorage.setItem(BOX_SORT_KEY, key); } catch { /* ignore */ }
          this.renderBox();
        },
      }, label);
      const chip = (type, label, color) => el('button', {
        class: `chip${type === this.boxType ? ' sel' : ''}`, 'data-type': type, style: `background:${color}`,
        onclick: () => { this.boxType = type; this.renderBox(); },
      }, label);
      tools.replaceChildren(
        el('div', { class: 'row' }, el('span', { class: 'lbl' }, 'Sort:'), ...BOX_SORTS.map(sortBtn)),
        el('div', { class: 'row' }, chip('all', `All ${g.box.length}`, '#c8ccd8'),
          ...TYPE_ORDER.filter(ty => counts[ty]).map(ty => chip(ty, `${ty} ${counts[ty]}`, TYPE_COLORS[ty]))));
    } else tools.replaceChildren();

    let list = g.box.map((c, i) => ({ c, i, sp: SPECIES[c.species] }));
    if (this.boxType !== 'all') list = list.filter(e => e.sp.type === this.boxType);
    const byName = (a, b) => a.sp.name.localeCompare(b.sp.name);
    const sorts = {
      newest: (a, b) => b.i - a.i,
      level: (a, b) => b.c.level - a.c.level || byName(a, b),
      name: (a, b) => byName(a, b) || b.c.level - a.c.level,
      type: (a, b) => TYPE_ORDER.indexOf(a.sp.type) - TYPE_ORDER.indexOf(b.sp.type) || b.c.level - a.c.level || byName(a, b),
    };
    list.sort(sorts[this.boxSort] || sorts.newest);
    document.getElementById('box-list').replaceChildren(...(list.length
      ? list.map(e => this.monCard(e.c, e.i, false))
      : [el('div', { class: 'empty' }, 'Empty. Catch more than 6 creatures and the extras land here.')]));
  }

  // "Let go" on a box card: ask first, in big friendly words. The Creature Book keeps it as caught.
  askLetGo(c) {
    const name = SPECIES[c.species].name;
    document.getElementById('box-confirm-text').replaceChildren(
      el('img', { src: portrait(c.species, 100, 86), width: 100, height: 86, alt: '' }),
      `Say goodbye to ${name} (Lv ${c.level})? It goes back to the wild.`);
    this.confirmYes = () => {
      const g = this.game;
      const i = g.box.indexOf(c);
      this.closeConfirm();
      if (i < 0) return;
      g.box.splice(i, 1);
      this.toast(`Bye bye, ${name}! It went back to the wild.`);
      this.refreshPanel();
      g.save?.();
    };
    this.confirmBox.classList.remove('hidden');
  }

  closeConfirm() {
    this.confirmYes = null;
    this.confirmBox.classList.add('hidden');
  }

  // Wiki links on the team screen: jump to a Creature Book page; its Back button comes back here.
  openBook(at) {
    this.teamScroll = this.partyPanel.querySelector('.panel')?.scrollTop || 0;
    this.closeConfirm();
    this.partyPanel.classList.add('hidden');
    this.game.book.open({ ...at, from: 'team' });
  }

  backToTeam() {
    this.openPanel('team');
    const panel = this.partyPanel.querySelector('.panel');
    if (panel && this.teamScroll != null) panel.scrollTop = this.teamScroll;
    this.teamScroll = null;
  }

  // The team panel or the Blocks panel.
  get panelOpen() { return !this.partyPanel.classList.contains('hidden') || !this.blocksPanel.classList.contains('hidden') || !this.bookPanel.classList.contains('hidden') || !this.homePanel.classList.contains('hidden'); }
  get homeOpen() { return !this.homePanel.classList.contains('hidden'); }

  openPanel(which = 'team') {
    this.setPrompt(''); // the prompt line would show through the panel
    if (which === 'book') { this.game.book.open(); return; }
    if (which === 'home') { // T22: homeUi.open() fills #home-body
      this.homePanel.classList.remove('hidden');
      const view = this.game.homeUi.want ?? 'home';
      this.game.homeUi.want = null;
      this.game.homeUi.open(view);
      return;
    }
    if (which === 'blocks') {
      this.renderBlocks();
      this.blocksPanel.classList.remove('hidden');
    } else {
      this.refreshPanel();
      this.partyPanel.classList.remove('hidden');
    }
  }

  // A question with two buttons (T28 gym rematch; reusable): ask({ text, yes, no, onYes, onNo }).
  ask({ text, yes = 'Battle!', no = 'Not now', onYes, onNo }) {
    this.askBox = this.askBox || document.getElementById('ask');
    if (!this.askWired) {
      this.askWired = true;
      document.getElementById('ask-yes').addEventListener('click', e => { e.stopPropagation(); this.askYes(); });
      document.getElementById('ask-no').addEventListener('click', e => { e.stopPropagation(); this.askNo(); });
    }
    this.asked = { onYes, onNo };
    document.getElementById('ask-text').textContent = text;
    document.getElementById('ask-yes').textContent = yes;
    document.getElementById('ask-no').textContent = no;
    this.askBox.classList.remove('hidden');
  }

  get asking() { return !!this.asked; }

  askYes() { const a = this.asked; this.closeAsk(); a?.onYes?.(); }

  askNo() { const a = this.asked; this.closeAsk(); a?.onNo?.(); }

  closeAsk() {
    this.asked = null;
    (this.askBox || document.getElementById('ask'))?.classList.add('hidden');
  }

  closePanel() {
    this.closeConfirm();
    this.teamScroll = null;
    this.partyPanel.classList.add('hidden');
    this.blocksPanel.classList.add('hidden');
    this.bookPanel.classList.add('hidden');
    this.homePanel.classList.add('hidden');
    this.game.homeUi?.close();
  }
}
