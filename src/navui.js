// T39a: the "Where to go" panel (#nav, opened with G or by tapping the guide line). Contract like missionui.js:
// open() (called by ui.openPanel('nav') AFTER #nav is shown), close() (ui.closePanel always calls it), refresh().
// The panel only picks a Destination (destinations.js); the guide does the rest.
import { TYPE_COLORS } from './species.js';
import { el } from './util.js';

export function createNavUi(game) {
  const body = () => document.getElementById('nav-body');
  let note = null;

  const guide = document.getElementById('guide');
  if (guide) {
    guide.title = 'Where to go (G)';
    guide.addEventListener('pointerdown', e => e.stopPropagation()); // a tap here is not a look-drag
    guide.addEventListener('click', e => { e.stopPropagation(); game.openNav?.(); });
  }

  function pick(dest, reason) {
    if (reason) { if (note) note.textContent = reason; return; }
    game.nav.choose(dest);
    game.updateGuide?.();
    game.closeNav?.();
  }

  const mark = on => (on ? el('span', { class: 'nav-on' }, '✓') : '');

  function row(r) {
    const { dest, reason } = r;
    const on = game.nav.choice?.id === dest.id;
    const sub = reason || (dest.help === 'none' ? "We'll tell you in words." : dest.help === 'near' ? "We'll get you close." : '');
    return el('button', { class: `nav-row${reason ? ' dim' : ''}${on ? ' on' : ''}`, onclick: () => pick(dest, reason) },
      el('span', { class: 'nav-icon' }, dest.icon), el('span', { class: 'nav-text' }, el('b', {}, dest.label), sub ? el('small', {}, sub) : ''), mark(on));
  }

  function tile(r) {
    const { dest, reason } = r, g = dest.gym, a = game.access.of(g);
    const got = game.badges.includes(g.def.id), on = game.nav.choice?.id === dest.id;
    const sign = got ? '✓' : a.wait() ? '☾' : a.closedText() ? '🔒' : '';
    return el('button', {
      class: `nav-tile${got ? ' got' : ''}${on ? ' on' : ''}${reason ? ' dim' : ''}`, title: g.def.name,
      style: `--c:${TYPE_COLORS[g.def.type] || '#888'}`, onclick: () => pick(dest, reason),
    }, el('span', { class: 'nt-dot' }, sign), el('span', { class: 'nt-name' }, g.def.name.replace(/ Gym$/, '')));
  }

  function render() {
    const rows = game.nav.rows();
    for (const r of rows) if (r.dest.gym) { const a = game.access.of(r.dest.gym); r.dest.help = a.help; r.dest.near = a.near; } // labels only
    const by = k => rows.filter(r => r.dest.group === k);
    const auto = !game.nav.choice;
    note = el('p', { class: 'nav-note' }, '');
    const section = (title, items) => (items.length ? [el('h3', {}, title), ...items] : []);
    const gyms = by('gyms');
    body().replaceChildren(
      el('h2', {}, 'Where do you want to go?'),
      el('button', { class: `nav-row${auto ? ' on' : ''}`, id: 'nav-auto', onclick: () => { game.nav.clear(); game.updateGuide?.(); game.closeNav?.(); } },
        el('span', { class: 'nav-icon' }, '⭐'), el('span', { class: 'nav-text' }, el('b', {}, 'Let the arrow choose'), el('small', {}, 'It shows the next gym.')), mark(auto)),
      note,
      ...(gyms.length ? [el('h3', {}, 'Gyms'), el('div', { class: 'nav-tiles' }, ...gyms.map(tile))] : []),
      ...section('Places', [...by('places'), ...by('realm')].map(row)),
      ...section('Now', by('now').map(row)),
    );
  }

  return {
    open() { render(); },
    refresh() { if (game.ui.navOpen) render(); },
    close() { note = null; },
  };
}
