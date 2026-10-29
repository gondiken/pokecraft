// Wave 17: the Swap panel (#swap): pick a creature to give or trade, the last yes, waiting, and creatures on their way.
// Contract like navui.js: open() (after #swap is shown), close() (ui.closePanel always calls it), refresh().
// It only shows game.swaps' state and calls game.swaps.choose / yes / no; the rules are in swaps.js / swapcore.js.
import { SPECIES } from './species.js';
import { portrait } from './ui.js';
import { el } from './util.js';
import { PARCELS, canGive, creatureItem } from './swapcore.js';

export function createSwapUi(game) {
  const body = () => document.getElementById('swap-body');
  const panel = () => document.getElementById('swap');
  let picked = null; // the creature tapped (waits for the big yes)
  let note = null;

  const isOpen = () => !!panel() && !panel().classList.contains('hidden');
  const pic = (species, w = 84, h = 72) => el('img', { src: portrait(species, w, h), width: w, height: h, alt: SPECIES[species]?.name || '' });

  // One big card for an item (their offer, or mine in the last yes).
  function card(item) {
    const P = PARCELS[item.kind];
    return el('div', { class: 'swap-card' }, pic(P.pic(item), 110, 94), el('b', {}, P.label(item)));
  }

  function tile(c, where) {
    const why = canGive(game, [creatureItem(c)]) === 'last' && game.swaps.view?.mode !== 'pick' ? 'Keep one friend in your team!' : '';
    return el('button', {
      class: `swap-tile${picked === c ? ' on' : ''}${why ? ' dim' : ''}`, 'data-uid': c.uid, 'data-where': where,
      onclick: () => { if (why) { if (note) note.textContent = why; return; } picked = c; render(); },
    }, pic(c.species), el('span', { class: 'st-name' }, SPECIES[c.species].name), el('span', { class: 'st-lv' }, `Lv ${c.level}`));
  }

  function chooser(v) {
    const s = game.swaps, theirs = s.theirs;
    const head = v.mode === 'gift' ? [el('h2', {}, `🎁 Give ${v.friend} a creature`), el('p', { class: 'swap-sub' }, 'Tap one, then Give!')]
      : v.mode === 'trade' ? [el('h2', {}, `🔁 Trade with ${v.friend}`), el('p', { class: 'swap-sub' }, 'Pick one to offer.')]
      : [el('h2', {}, `🔁 ${v.friend} offers`), ...(theirs ? [card(theirs.give[0])] : []), el('p', { class: 'swap-sub' }, 'Pick one of yours to swap for it.')];
    const word = v.mode === 'gift' ? '🎁 Give!' : v.mode === 'trade' ? '🔁 Offer!' : '🔁 Swap!';
    const bar = picked && el('div', { class: 'swap-bar' }, pic(picked.species, 70, 60),
      el('span', {}, v.mode === 'gift' ? `Give ${SPECIES[picked.species].name} to ${v.friend}?` : v.mode === 'trade' ? `Offer ${SPECIES[picked.species].name}?` : `Swap ${SPECIES[picked.species].name}?`),
      el('button', { class: 'primary big', id: 'swap-go', onclick: () => { const c = picked; picked = null; game.swaps.choose(c); } }, word));
    note = el('p', { class: 'swap-note' }, '');
    return [...head, bar || '', note,
      el('h3', {}, 'Your team'), el('div', { class: 'swap-tiles' }, ...game.party.map(c => tile(c, 'party'))),
      ...(game.box.length ? [el('h3', {}, 'Storage Box'), el('div', { class: 'swap-tiles' }, ...game.box.map(c => tile(c, 'box')))] : [])];
  }

  function decide() {
    const m = game.swaps.mine;
    if (!m?.get.length) return [el('p', {}, '...')];
    return [el('h2', {}, `🔁 ${m.name} offers`), el('div', { class: 'swap-pair' }, card(m.get[0]), el('span', { class: 'swap-arrow' }, 'for your'), card(m.give[0])),
      el('p', { class: 'swap-btns' },
        el('button', { class: 'primary big', id: 'swap-yes', onclick: () => game.swaps.yes() }, '🔁 Swap!'),
        el('button', { class: 'big', id: 'swap-no', onclick: () => game.swaps.no() }, 'No thanks'))];
  }

  // Creatures in escrow: on the way until the friend's game says it got them.
  function onTheWay() {
    const out = Object.values(game.swaps.ledger.out);
    if (!out.length) return [];
    return [el('h3', {}, 'On the way'), ...out.map(e => el('div', { class: 'swap-way' }, pic(PARCELS[e.give[0].kind].pic(e.give[0]), 56, 48),
      `${e.give.map(i => PARCELS[i.kind].label(i)).join(', ')} → ${e.name || 'a friend'}. Play together again to finish!`))];
  }

  function render() {
    if (!isOpen()) return;
    const v = game.swaps.view;
    let parts;
    if (!v) parts = [el('h2', {}, 'Gifts and trades'), el('p', {}, 'Play together with a friend, then open the pause screen to give or trade.')];
    else if (v.mode === 'gift' || v.mode === 'trade' || v.mode === 'pick') parts = chooser(v);
    else if (v.mode === 'decide') parts = decide();
    else parts = [el('h2', {}, v.mode === 'wait' ? '⏳' : '🎁'), el('p', { class: 'swap-msg' }, v.note || '')];
    body().replaceChildren(...parts, ...onTheWay());
  }

  return {
    get isOpen() { return isOpen(); },
    open() { picked = null; render(); },
    refresh() { if (picked && !game.party.includes(picked) && !game.box.includes(picked)) picked = null; render(); },
    close() { picked = null; note = null; game.swaps?.closed(); },
  };
}
