// HUD, toasts, team screen and creature portraits.
import * as THREE from 'three';
import { BLOCKS, PLACEABLE, drawBlockIcon } from './blocks.js';
import { SPECIES, MOVES, TYPE_COLORS, statsFor, nameOf, xpForLevel, buildModel, disposeModel } from './species.js';
import { hpColor, el } from './util.js';
import { GYMS } from './gyms.js';

let portraitRenderer = null;
const portraitCache = new Map();

// Renders a creature model to a small image (cached per species).
export function portrait(species, w = 140, h = 120) {
  const key = `${species}:${w}x${h}`;
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
    this.badgeRow = document.getElementById('badges');
    this.titleEl = el('div', { id: 'champion-title', class: 'hidden' }, '★ Champion ★');
    this.badgeRow.after(this.titleEl);
    this.partyPanel = document.getElementById('party');
    this.blocksPanel = document.getElementById('blocks');
    this.slots = [];
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
    }, drawBlockIcon(this.atlas, id), el('span', {}, i + 1)));
    this.hotbar.replaceChildren(...this.slots);
  }

  renderBlocks() {
    const g = this.game;
    document.getElementById('blocks-slot').textContent = g.selected + 1;
    document.getElementById('block-list').replaceChildren(...PLACEABLE.map(id => el('button', {
      class: id === g.hotbar[g.selected] ? 'sel' : '', title: BLOCKS[id].name,
      onclick: () => { g.hotbar[g.selected] = id; this.renderHud(); g.closeBlocks?.(); },
    }, drawBlockIcon(this.atlas, id), BLOCKS[id].name)));
  }

  renderHud() {
    const g = this.game;
    if (this.hotbarKey !== g.hotbar.join()) this.buildHotbar();
    this.slots.forEach((s, i) => s.classList.toggle('sel', i === g.selected));
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
    } else if (g.party.length < 6) {
      btns.push(el('button', { onclick: () => { g.party.push(...g.box.splice(i, 1)); this.refreshPanel(); } }, 'To team'));
    }
    return el('div', { class: `mon${inParty && i === 0 ? ' lead' : ''}` },
      el('div', { class: 'top' },
        el('img', { src: portrait(c.species, 70, 60), width: 70, height: 60, alt: '' }),
        el('div', { style: 'flex:1;margin-left:8px' },
          el('div', { class: 'nm' }, sp.name),
          el('div', {}, el('span', { class: 'type', style: `background:${TYPE_COLORS[sp.type]}` }, sp.type), ` Lv${c.level}`))),
      el('div', {}, `HP ${c.hp}/${st.maxHp} · ATK ${st.atk} · DEF ${st.def} · SPD ${st.spd}`),
      el('div', { class: 'hpbar' }, el('div', { style: `width:${frac * 100}%;background:${hpColor(frac)}` })),
      el('div', { class: 'xpbar' }, el('div', { style: `width:${Math.max(0, Math.min(1, xpFrac)) * 100}%` })),
      el('div', { class: 'moves' }, ...c.moves.map(m => el('span', { style: `background:${TYPE_COLORS[MOVES[m].type]}` }, MOVES[m].name))),
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
    const box = document.getElementById('box-list');
    box.replaceChildren(...(g.box.length
      ? g.box.map((c, i) => this.monCard(c, i, false))
      : [el('div', { class: 'empty' }, 'Empty. Catch more than 6 creatures and the extras land here.')]));
    this.renderHud();
  }

  // The team panel or the Blocks panel.
  get panelOpen() { return !this.partyPanel.classList.contains('hidden') || !this.blocksPanel.classList.contains('hidden'); }

  openPanel(which = 'team') {
    if (which === 'blocks') {
      this.renderBlocks();
      this.blocksPanel.classList.remove('hidden');
    } else {
      this.refreshPanel();
      this.partyPanel.classList.remove('hidden');
    }
  }

  closePanel() {
    this.partyPanel.classList.add('hidden');
    this.blocksPanel.classList.add('hidden');
  }
}
