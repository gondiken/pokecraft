// The Creature Book: every creature you have seen (picture, name, type) and caught (full page).
import { SPECIES, SPAWNS, MOVES, TYPE_COLORS, effectiveness, moveInfo } from './species.js';
import { BLOCKS } from './blocks.js';
import { condOf, condText } from './spawnrules.js';
import { portrait } from './ui.js';
import { el } from './util.js';

// One-of-a-kind legendaries (never wild, never caught) go last and are not part of the totals.
const bookOrder = () => {
  const ids = Object.keys(SPECIES);
  return [...ids.filter(id => !SPECIES[id].legendary), ...ids.filter(id => SPECIES[id].legendary)];
};
export const TYPES = () => Object.keys(TYPE_COLORS);
const BIOME_NAMES = {
  plains: 'Plains', meadow: 'Flower meadows', forest: 'Forests', swamp: 'Swamps', beach: 'Beaches', water: 'Lakes and sea',
  desert: 'Deserts', mountain: 'Mountains', snow: 'Snowy hills', taiga: 'Snowy forests', peak: 'Mountain peaks', cave: 'Caves',
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
  // Found in every biome under one condition (Cyber creatures): one row instead of a dozen.
  const biomes = Object.keys(SPAWNS);
  // Found at a home (T21): one row, whatever the biome.
  for (const when of new Set(out.map(o => o.when))) {
    if (!condOf(when)?.place) continue;
    const rows = out.filter(o => o.when === when);
    const best = rows.reduce((a, r) => (rank(r.rarity) > rank(a) ? r.rarity : a), 'rare');
    const at = out.findIndex(o => o.when === when);
    for (let i = out.length - 1; i >= 0; i--) if (out[i].when === when) out.splice(i, 1);
    out.splice(at, 0, { biome: null, name: cap(condText(when)), when, rarity: best, words: null });
  }
  for (const when of new Set(out.map(o => o.when))) {
    const rows = out.filter(o => o.when === when);
    if (rows.length < biomes.length || !biomes.every(b => rows.some(r => r.biome === b))) continue;
    const rank2 = r => ['rare', 'sometimes', 'common'].indexOf(r);
    const best = rows.reduce((a, r) => (rank2(r.rarity) > rank2(a) ? r.rarity : a), 'rare');
    const at = out.findIndex(o => o.when === when);
    for (let i = out.length - 1; i >= 0; i--) if (out[i].when === when) out.splice(i, 1);
    out.splice(at, 0, { biome: null, name: 'Anywhere', when, rarity: best });
  }
  for (const o of out) if (o.words === undefined) o.words = condText(o.when) ?? o.when;
  return out;
}

function evolvesFrom(id) {
  for (const [from, s] of Object.entries(SPECIES)) if (s.evolve?.into === id) return { from, level: s.evolve.level };
  return null;
}

function evolutionChain(id) {
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

function typeMatchups(type) {
  const all = TYPES();
  return {
    strong: all.filter(d => effectiveness(type, d) > 1),
    weak: all.filter(a => effectiveness(a, type) > 1),
    tough: all.filter(a => effectiveness(a, type) > 0 && effectiveness(a, type) < 1),
    immune: all.filter(a => effectiveness(a, type) === 0),
  };
}

function learnList(id) {
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

// Wiki links: a type chip that opens that type's list, a move name that opens the move's page.
export const typeLink = (type, go) => el('button', {
  class: 'chip wlink-chip', 'data-type': type, style: `background:${TYPE_COLORS[type] || '#888'}`,
  onclick: e => { e.stopPropagation(); go(type); },
}, type);
const TRAIL_MAX = 30;

export class Book {
  constructor(game) {
    this.game = game;
    this.seen = new Set();
    this.caught = new Set();
    this.filter = 'all';
    this.page = null; // the species page shown, or null
    this.view = { kind: 'list' }; // what is shown: { kind: 'list' } | { kind: 'species', id } | { kind: 'move', id }
    this.trail = []; // pages Back returns to (newest last); { kind: 'team' } means "back to the team screen"
    this.panel = document.getElementById('book');
    this.countEl = document.getElementById('book-count');
    this.body = document.getElementById('book-body');
    this.renderId = 0;
  }

  reset() { this.seen.clear(); this.caught.clear(); this.page = null; this.view = { kind: 'list' }; this.trail = []; this.filter = 'all'; }

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

  // open() shows the last page; open({ species | move | type, from: 'team' }) jumps to a page, and
  // with from: 'team' the Back button returns to the team screen.
  open(at = null) {
    this.syncTeam();
    this.trail = this.trail.filter(p => p.kind !== 'team');
    if (at) {
      this.trail = at.from === 'team' ? [{ kind: 'team' }] : [];
      if (at.type) this.filter = at.type;
      this.view = at.species && SPECIES[at.species] ? { kind: 'species', id: at.species }
        : at.move && MOVES[at.move] ? { kind: 'move', id: at.move } : { kind: 'list' };
    }
    this.panel.classList.remove('hidden');
    this.render(this.view, at ? 0 : null);
  }

  close() { this.panel.classList.add('hidden'); }

  rerender() { this.render(this.view, null); }

  // Go to a page; Back comes back here (with the same scroll). replace = browse without a new Back step.
  go(view, replace = false) {
    if (!replace && (view.kind !== this.view.kind || view.id !== this.view.id)) this.remember();
    this.render(view, 0);
  }

  remember() {
    if (!this.isOpen) return;
    this.trail.push({ ...this.view, filter: this.filter, scroll: this.scroller.scrollTop });
    if (this.trail.length > TRAIL_MAX) this.trail.splice(this.trail[0].kind === 'team' ? 1 : 0, 1);
  }

  back() {
    const prev = this.trail.pop();
    if (!prev) { this.go({ kind: 'list' }, true); return; }
    if (prev.kind === 'team') { this.close(); this.game.ui?.backToTeam(); return; }
    if (prev.filter) this.filter = prev.filter;
    this.render(prev, prev.scroll || 0);
  }

  // scroll: a number to scroll to, or null to keep the scroll where it is.
  render(view, scroll) {
    const keep = this.scroller.scrollTop;
    this.view = { kind: view.kind, id: view.id };
    this.page = view.kind === 'species' ? view.id : null;
    this.renderId++;
    this.updateCount();
    if (view.kind === 'species' && SPECIES[view.id]) this.renderSpecies(view.id);
    else if (view.kind === 'move' && MOVES[view.id]) this.renderMove(view.id);
    else { this.view = { kind: 'list' }; this.page = null; this.renderList(); }
    this.scroller.scrollTop = scroll ?? keep;
  }

  showList() { this.go({ kind: 'list' }); }
  showDetail(id) { if (SPECIES[id]) this.go({ kind: 'species', id }); }
  showMove(id) { if (MOVES[id]) this.go({ kind: 'move', id }); }
  showType(type) {
    if (!TYPE_COLORS[type]) return;
    if (this.view.kind !== 'list' || this.filter !== type) this.remember();
    this.filter = type;
    this.render({ kind: 'list' }, 0);
  }

  // Close the Book and open the team screen (from the "Yours" line on a page).
  toTeam() { this.close(); this.trail = []; this.game.ui?.backToTeam(); }

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

  typeLink(type) { return typeLink(type, t => this.showType(t)); }

  // The top row: Back (to the last page, or to the team screen) and, on species pages, ‹ › and the number.
  topBar(...rest) {
    const last = this.trail[this.trail.length - 1];
    const label = last?.kind === 'team' ? '‹ Team' : '‹ Back';
    return el('div', { id: 'book-top' }, el('button', { id: 'book-back', onclick: () => this.back() }, label), ...rest);
  }

  renderList() {
    const renderId = this.renderId;
    const queue = [];
    const filters = el('div', { id: 'book-filters' },
      ...['all', ...TYPES()].map(f => el('button', {
        class: 'book-filter' + (this.filter === f ? ' sel' : ''), 'data-filter': f,
        style: f === 'all' ? '' : `background:${TYPE_COLORS[f]}`,
        onclick: () => { this.filter = f; this.render({ kind: 'list' }, 0); },
      }, f)));
    const ids = this.visibleIds();
    const parts = [];
    if (this.trail.length) parts.push(this.topBar());
    parts.push(filters);
    if (this.filter !== 'all') {
      const mine = bookOrder().filter(id => SPECIES[id].type === this.filter);
      const s = mine.filter(id => this.seen.has(id)).length, c = mine.filter(id => this.caught.has(id)).length;
      parts.push(el('p', { id: 'book-typeinfo' }, `${cap(this.filter)}: ${s} seen · ${c} caught (of ${mine.length})`));
      parts.push(this.matchupSection(this.filter, 'book-typematch'));
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
  }

  renderSpecies(id) {
    const renderId = this.renderId;
    const queue = [];
    const sp = SPECIES[id];
    const caught = this.caught.has(id), seen = this.seen.has(id);
    const ids = this.visibleIds();
    const at = ids.indexOf(id);
    const step = d => { if (ids.length) this.go({ kind: 'species', id: ids[(Math.max(at, 0) + d + ids.length) % ids.length] }, true); };

    const top = this.topBar(
      el('button', { id: 'book-prev', onclick: () => step(-1) }, '‹'),
      el('button', { id: 'book-next', onclick: () => step(1) }, '›'),
      el('span', { class: 'book-num' }, num(id)));

    const left = el('div', { class: 'book-pic' }, this.picture(id, 220, 188, queue, seen ? sp.name : ''),
      el('h3', { class: 'book-title' }, seen ? sp.name : '???'));
    if (seen) left.append(this.typeLink(sp.type));
    const info = el('div', { class: 'book-info' });
    if (!seen) {
      info.append(el('p', {}, "You haven't met this creature yet. Keep exploring!"));
    } else if (!caught) {
      info.append(el('p', {}, 'Catch one to fill in this page!'));
    } else {
      info.append(el('p', { class: 'book-desc' }, sp.desc));
      const yours = this.yoursSection(id);
      if (yours) info.append(yours);
      info.append(this.livesSection(id), this.evolutionSection(id, queue), this.movesSection(id), this.matchupSection(sp.type));
    }
    this.body.replaceChildren(top, el('div', { id: 'book-detail' }, left, info));
    this.fillImages(queue, renderId);
  }

  // A move's page: its type and what it does, and the creatures you know that learn it.
  renderMove(id) {
    const renderId = this.renderId;
    const queue = [];
    const m = MOVES[id];
    const learners = [];
    for (const sid of bookOrder()) {
      const l = learnList(sid).find(x => x.move === id);
      if (l) learners.push({ id: sid, level: l.level });
    }
    const known = learners.filter(l => this.seen.has(l.id));
    const hidden = learners.length - known.length;
    const info = el('div', { class: 'book-info' },
      el('p', {}, cap(moveInfo(id).text || 'a move') + '.'),
      moveInfo(id).note && el('p', { class: 'book-note' }, moveInfo(id).note),
      m.acc != null && el('p', { class: 'book-note' }, m.sure || m.acc >= 1 ? 'Always hits.' : `Hits ${Math.round(m.acc * 100)} times out of 100.`),
      el('h3', {}, 'Who learns it'));
    if (known.length) {
      info.append(el('div', { class: 'book-evo book-learners' }, ...known.map(l =>
        el('button', { class: 'book-stage', 'data-species': l.id, onclick: () => this.showDetail(l.id) },
          this.picture(l.id, 70, 60, queue), el('span', {}, SPECIES[l.id].name), el('span', { class: 'book-lv' }, `Lv ${l.level}`)))));
    }
    if (hidden) info.append(el('p', { class: 'book-note' }, known.length
      ? `…and ${hidden} more you haven't met yet.` : `${hidden} creature${hidden === 1 ? '' : 's'} you haven't met yet.`));
    if (!learners.length) info.append(el('p', {}, 'No creature learns it by training.'));
    const left = el('div', { class: 'book-pic book-movepic', style: `border-color:${TYPE_COLORS[m.type] || '#888'}` },
      el('h3', { class: 'book-title' }, (m.sig ? '★ ' : '') + m.name), this.typeLink(m.type));
    this.body.replaceChildren(this.topBar(), el('div', { id: 'book-detail', class: 'book-move-page', 'data-move': id }, left, info));
    this.fillImages(queue, renderId);
  }

  // "Yours": the levels of this creature in your team and box, with a link to the team screen.
  yoursSection(id) {
    const g = this.game;
    const lv = list => (list || []).filter(c => c.species === id).map(c => `Lv ${c.level}`);
    const team = lv(g.party), box = lv(g.box);
    if (!team.length && !box.length) return null;
    const words = [team.length && `In your team: ${team.join(', ')}`, box.length && `In your box: ${box.join(', ')}`].filter(Boolean).join(' · ');
    return el('div', { class: 'book-sec book-yours' }, el('h3', {}, 'Yours'),
      el('p', {}, words, ' ', el('button', { class: 'wlink', id: 'book-to-team', onclick: () => this.toTeam() }, 'See your team')));
  }

  livesSection(id) {
    const out = el('div', { class: 'book-sec' }, el('h3', {}, 'Where it lives'));
    const info = spawnInfo(id);
    if (info.length) {
      out.append(el('div', { class: 'book-chips' }, ...info.map(s =>
        el('span', { class: 'chip plain' }, [s.name, s.words, s.rarity].filter(Boolean).join(' · ')))));
    } else {
      out.append(el('p', {}, 'Not found in the wild.'));
      const from = evolvesFrom(id);
      if (from) {
        const known = this.seen.has(from.from);
        out.append(el('p', {}, 'Train a ', known
          ? el('button', { class: 'wlink', 'data-species': from.from, onclick: () => this.showDetail(from.from) }, SPECIES[from.from].name)
          : '???', ` to Lv ${from.level} to get one.`));
      }
    }
    const d = SPECIES[id].disguise;
    if (d) out.append(el('p', {}, `Hides as a ${BLOCKS[d.blocks[0]].name.toLowerCase()} block. Watch for a blink!`));
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
        el('span', { class: 'lv' }, `Lv ${level}`),
        el('button', { class: 'wlink mn', 'data-move': move, onclick: () => this.showMove(move) }, (m.sig ? '★ ' : '') + m.name),
        this.typeLink(m.type),
        el('span', { class: 'mp' }, moveInfo(move).text));
    }).filter(Boolean);
    out.append(el('div', { class: 'book-moves' }, ...rows));
    return out;
  }

  matchupSection(type, id = null) {
    const m = typeMatchups(type);
    const out = el('div', { class: 'book-sec', id });
    const add = (title, list, note) => {
      if (!list.length) return;
      out.append(el('h3', {}, title), el('div', { class: 'book-chips' }, ...list.map(t => this.typeLink(t))), el('p', { class: 'book-note' }, note));
    };
    add('Strong against', m.strong, 'for its own type of attacks');
    add('Weak against', m.weak, 'attacks of these types hurt it more');
    add('Shrugs off', m.tough, 'attacks of these types hurt it less');
    add("Can't be hurt by", m.immune, 'attacks of these types do nothing');
    return out;
  }
}
