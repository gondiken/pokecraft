// The Creature Book: every creature you have seen (picture, name, type) and caught (full page).
import { SPECIES, SPAWNS, MOVES, TYPE_COLORS, effectiveness, moveInfo } from './species.js';
import { portrait } from './ui.js';
import { el } from './util.js';

// One-of-a-kind legendaries (never wild, never caught) go last and are not part of the totals.
export const bookOrder = () => {
  const ids = Object.keys(SPECIES);
  return [...ids.filter(id => !SPECIES[id].legendary), ...ids.filter(id => SPECIES[id].legendary)];
};
export const TYPES = () => Object.keys(TYPE_COLORS);
export const BIOME_NAMES = {
  plains: 'Plains', meadow: 'Flower meadows', forest: 'Forests', swamp: 'Swamps', beach: 'Beaches', water: 'Lakes and sea',
  desert: 'Deserts', mountain: 'Mountains', snow: 'Snowy hills', taiga: 'Snowy forests', peak: 'Mountain peaks',
};
const biomeName = b => BIOME_NAMES[b] || (b.charAt(0).toUpperCase() + b.slice(1));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const num = id => '#' + String(bookOrder().indexOf(id) + 1).padStart(3, '0');

// Where a creature lives in the wild: one entry per biome and time of day.
export function spawnInfo(id) {
  const out = [];
  const rank = r => ['rare', 'sometimes', 'common'].indexOf(r);
  for (const [biome, table] of Object.entries(SPAWNS)) {
    for (const [sp, weight, when] of table) {
      if (sp !== id) continue;
      const rarity = weight >= 2 ? 'common' : weight >= 0.5 ? 'sometimes' : 'rare';
      const found = out.find(o => o.biome === biome && o.when === (when || null));
      if (found) {
        if (rank(rarity) > rank(found.rarity)) found.rarity = rarity;
      } else out.push({ biome, name: biomeName(biome), when: when || null, rarity });
    }
  }
  return out;
}

export function evolvesFrom(id) {
  for (const [from, s] of Object.entries(SPECIES)) if (s.evolve?.into === id) return { from, level: s.evolve.level };
  return null;
}

export function evolutionChain(id) {
  let root = id;
  for (let i = 0; i < 5; i++) { const p = evolvesFrom(root); if (!p) break; root = p.from; }
  const chain = [];
  let cur = root;
  for (let i = 0; i < 5 && cur && SPECIES[cur]; i++) {
    const ev = SPECIES[cur].evolve;
    chain.push({ id: cur, level: ev ? ev.level : null });
    cur = ev?.into;
  }
  return chain;
}

export function typeMatchups(type) {
  const all = TYPES();
  return {
    strong: all.filter(d => effectiveness(type, d) > 1),
    weak: all.filter(a => effectiveness(a, type) > 1),
    tough: all.filter(a => effectiveness(a, type) > 0 && effectiveness(a, type) < 1),
    immune: all.filter(a => effectiveness(a, type) === 0),
  };
}

export function learnList(id) {
  const seen = new Set();
  const out = [];
  for (const [level, move] of SPECIES[id].learn || []) {
    if (seen.has(move)) continue;
    seen.add(move);
    out.push({ level, move });
  }
  return out.sort((a, b) => a.level - b.level);
}

const chip = type => el('span', { class: 'chip', style: `background:${TYPE_COLORS[type] || '#888'}` }, type);

export class Book {
  constructor(game) {
    this.game = game;
    this.seen = new Set();
    this.caught = new Set();
    this.filter = 'all';
    this.page = null;
    this.panel = document.getElementById('book');
    this.countEl = document.getElementById('book-count');
    this.body = document.getElementById('book-body');
    this.renderId = 0;
    this.listScroll = 0;
  }

  reset() { this.seen.clear(); this.caught.clear(); this.page = null; }

  load(saved) {
    this.reset();
    for (const id of saved?.seen || []) if (SPECIES[id]) this.seen.add(id);
    for (const id of saved?.caught || []) if (SPECIES[id]) { this.caught.add(id); this.seen.add(id); }
    this.syncTeam();
  }

  markSeen(id) {
    if (this.seen.has(id) || !SPECIES[id]) return;
    this.seen.add(id);
    if (this.isOpen) this.rerender();
  }

  markCaught(id) {
    if (!SPECIES[id]) return;
    const isNew = !this.caught.has(id);
    this.seen.add(id);
    this.caught.add(id);
    if (isNew) {
      if (this.game.started) this.game.ui?.toast(`${SPECIES[id].name} was added to your Creature Book!`);
      if (this.isOpen) this.rerender();
    }
  }

  syncTeam() {
    for (const c of [...(this.game.party || []), ...(this.game.box || [])]) {
      if (SPECIES[c.species]) { this.seen.add(c.species); this.caught.add(c.species); }
    }
  }

  toSave() {
    const order = bookOrder();
    return { seen: order.filter(id => this.seen.has(id)), caught: order.filter(id => this.caught.has(id)) };
  }

  counts() {
    const ids = bookOrder().filter(id => !SPECIES[id].legendary);
    return { seen: ids.filter(id => this.seen.has(id)).length, caught: ids.filter(id => this.caught.has(id)).length, total: ids.length };
  }

  get isOpen() { return !this.panel.classList.contains('hidden'); }

  open() {
    this.syncTeam();
    this.rerender();
    this.panel.classList.remove('hidden');
  }

  close() { this.panel.classList.add('hidden'); }

  rerender() { if (this.page) this.showDetail(this.page, true); else this.showList(); }

  updateCount() {
    const c = this.counts();
    this.countEl.textContent = `Seen ${c.seen} / ${c.total} · Caught ${c.caught} / ${c.total}`;
  }

  get scroller() { return this.body.closest('.panel') || this.panel; }

  visibleIds() {
    return bookOrder().filter(id => this.filter === 'all' || SPECIES[id].type === this.filter);
  }

  // Fills in picture src values a few at a time so the page stays responsive.
  fillImages(items, renderId) {
    const queue = [...items];
    const step = () => {
      if (renderId !== this.renderId) return;
      for (let i = 0; i < 4 && queue.length; i++) {
        const { img, id, w, h, silhouette } = queue.shift();
        img.src = portrait(id, w, h, silhouette);
      }
      if (queue.length) setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  picture(id, w, h, queue, alt = '') {
    const img = el('img', { width: w, height: h, alt });
    queue.push({ img, id, w, h, silhouette: !this.seen.has(id) });
    return img;
  }

  showList() {
    this.page = null;
    const renderId = ++this.renderId;
    this.updateCount();
    const queue = [];
    const filters = el('div', { id: 'book-filters' },
      ...['all', ...TYPES()].map(f => el('button', {
        class: 'book-filter' + (this.filter === f ? ' sel' : ''), 'data-filter': f,
        style: f === 'all' ? '' : `background:${TYPE_COLORS[f]}`,
        onclick: () => { this.filter = f; this.listScroll = 0; this.showList(); },
      }, f)));
    const ids = this.visibleIds();
    const parts = [filters];
    if (this.filter !== 'all') {
      const mine = bookOrder().filter(id => SPECIES[id].type === this.filter);
      const s = mine.filter(id => this.seen.has(id)).length, c = mine.filter(id => this.caught.has(id)).length;
      parts.push(el('p', { id: 'book-typeinfo' }, `${cap(this.filter)}: ${s} seen · ${c} caught (of ${mine.length})`));
    }
    parts.push(el('div', { id: 'book-grid' }, ...ids.map(id => {
      const state = this.caught.has(id) ? 'caught' : this.seen.has(id) ? 'seen' : 'unseen';
      const sp = SPECIES[id];
      return el('button', { class: `book-card ${state}`, 'data-species': id, onclick: () => this.showDetail(id) },
        this.picture(id, 96, 82, queue),
        el('span', { class: 'book-num' }, num(id)),
        el('span', { class: 'book-name' }, state === 'unseen' ? '???' : sp.name),
        el('span', { class: 'book-bar', style: state === 'unseen' ? '' : `background:${TYPE_COLORS[sp.type]}` }));
    })));
    this.body.replaceChildren(...parts);
    this.fillImages(queue, renderId);
    this.scroller.scrollTop = this.listScroll;
  }

  showDetail(id, keepScroll = false) {
    if (!SPECIES[id]) return;
    if (this.page === null) this.listScroll = this.scroller.scrollTop;
    const scroll = this.scroller.scrollTop;
    this.page = id;
    const renderId = ++this.renderId;
    this.updateCount();
    const queue = [];
    const sp = SPECIES[id];
    const caught = this.caught.has(id), seen = this.seen.has(id);
    const ids = this.visibleIds();
    const at = ids.indexOf(id);
    const go = d => { if (ids.length) this.showDetail(ids[(Math.max(at, 0) + d + ids.length) % ids.length]); };

    const top = el('div', { id: 'book-top' },
      el('button', { id: 'book-back', onclick: () => this.showList() }, '‹ Back'),
      el('button', { id: 'book-prev', onclick: () => go(-1) }, '‹'),
      el('button', { id: 'book-next', onclick: () => go(1) }, '›'),
      el('span', { class: 'book-num' }, num(id)));

    const left = el('div', { class: 'book-pic' }, this.picture(id, 220, 188, queue, seen ? sp.name : ''),
      el('h3', { class: 'book-title' }, seen ? sp.name : '???'));
    if (seen) left.append(chip(sp.type));
    const info = el('div', { class: 'book-info' });
    if (!seen) {
      info.append(el('p', {}, "You haven't met this creature yet. Keep exploring!"));
    } else if (!caught) {
      info.append(el('p', {}, 'Catch one to fill in this page!'));
    } else {
      info.append(el('p', { class: 'book-desc' }, sp.desc));
      info.append(this.livesSection(id), this.evolutionSection(id, queue), this.movesSection(id), this.matchupSection(sp.type));
    }
    this.body.replaceChildren(top, el('div', { id: 'book-detail' }, left, info));
    this.fillImages(queue, renderId);
    this.scroller.scrollTop = keepScroll ? scroll : 0;
  }

  livesSection(id) {
    const out = el('div', { class: 'book-sec' }, el('h3', {}, 'Where it lives'));
    const info = spawnInfo(id);
    if (info.length) {
      out.append(el('div', { class: 'book-chips' }, ...info.map(s =>
        el('span', { class: 'chip plain' }, [s.name, s.when, s.rarity].filter(Boolean).join(' · ')))));
    } else {
      out.append(el('p', {}, 'Not found in the wild.'));
      const from = evolvesFrom(id);
      if (from) {
        const nm = this.seen.has(from.from) ? SPECIES[from.from].name : '???';
        out.append(el('p', {}, `Train a ${nm} to Lv ${from.level} to get one.`));
      }
    }
    return out;
  }

  evolutionSection(id, queue) {
    const out = el('div', { class: 'book-sec' }, el('h3', {}, 'Evolution'));
    const chain = evolutionChain(id);
    if (chain.length < 2) { out.append(el('p', {}, 'Does not evolve.')); return out; }
    const row = el('div', { class: 'book-evo' });
    chain.forEach((st, i) => {
      if (i > 0) row.append(el('span', { class: 'book-arrow' }, `→ Lv ${chain[i - 1].level} →`));
      const known = this.seen.has(st.id);
      row.append(el('button', { class: 'book-stage' + (st.id === id ? ' here' : ''), 'data-species': st.id, onclick: () => this.showDetail(st.id) },
        this.picture(st.id, 70, 60, queue), el('span', {}, known ? SPECIES[st.id].name : '???')));
    });
    out.append(row);
    return out;
  }

  movesSection(id) {
    const out = el('div', { class: 'book-sec' }, el('h3', {}, 'Moves it learns'));
    const rows = learnList(id).map(({ level, move }) => {
      const m = MOVES[move];
      if (!m) return null;
      return el('div', { class: 'book-move' },
        el('span', { class: 'lv' }, `Lv ${level}`), el('span', { class: 'mn' }, (m.sig ? '★ ' : '') + m.name), chip(m.type),
        el('span', { class: 'mp' }, moveInfo(move).text));
    }).filter(Boolean);
    out.append(el('div', { class: 'book-moves' }, ...rows));
    return out;
  }

  matchupSection(type) {
    const m = typeMatchups(type);
    const out = el('div', { class: 'book-sec' });
    const add = (title, list, note) => {
      if (!list.length) return;
      out.append(el('h3', {}, title), el('div', { class: 'book-chips' }, ...list.map(chip)), el('p', { class: 'book-note' }, note));
    };
    add('Strong against', m.strong, 'for its own type of attacks');
    add('Weak against', m.weak, 'attacks of these types hurt it more');
    add('Shrugs off', m.tough, 'attacks of these types hurt it less');
    add("Can't be hurt by", m.immune, 'attacks of these types do nothing');
    return out;
  }
}
