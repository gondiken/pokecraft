// Wave 17 (owner 2026-10-30): two screens, both plain.
//  1. The friend menu (#friend): look at a friend and press E (or tap them): Battle, Trade or Hide and seek with THAT friend.
//  2. Trading happens in your own team screen (P), the same cards, sorting and type chips: ui.js asks `ui.tradeView` for the
//     bar on top (what you give, what they give, Ready) and each card's button (Offer / Take back). Both friends see it at once.
// Only game.swaps holds the trade's state; this file shows it.
import { SPECIES } from './species.js';
import { portrait } from './ui.js';
import { el } from './util.js';
import { PARCELS, canGive, creatureItem } from './swapcore.js';

export function createSwapUi(game) {
  const menu = () => document.getElementById('friend');
  let friend = null; // the avatar the menu is about
  let note = null;
  const pic = (species, w = 84, h = 72) => el('img', { src: portrait(species, w, h), width: w, height: h, alt: SPECIES[species]?.name || '' });
  const isOpen = () => !!menu() && !menu().classList.contains('hidden');
  const S = () => game.swaps.session;

  // ---- 1. the friend menu ----
  function renderMenu() {
    if (!isOpen() || !friend) return;
    const a = friend, hs = game.hideSeek;
    const near = !!hs?.nearby?.().includes(a);
    const tradeWhy = game.swaps.whyNot(a);
    note = el('p', { class: 'fm-note' }, '');
    const choice = (id, icon, word, sub, why, go) => el('button', {
      class: `fm-btn${why ? ' dim' : ''}`, 'data-friend': id,
      onclick: () => { if (why) { note.textContent = why; return; } game.closeFriend?.(); go(); },
    }, el('span', { class: 'fm-icon' }, icon), el('span', { class: 'fm-text' }, el('b', {}, word), sub ? el('small', {}, sub) : ''));
    document.getElementById('friend-body').replaceChildren(
      el('h2', {}, `👋 ${a.name}`),
      el('p', { class: 'fm-sub' }, 'What do you want to do?'),
      el('div', { class: 'fm-list' },
        choice('battle', '⚔️', 'Battle', 'Your creatures stay safe.', '', () => game.duels.challenge(a)),
        choice('trade', '🔁', 'Trade', 'Swap creatures, or give a present.', tradeWhy, () => game.swaps.invite(a)),
        choice('hide', '🙈', 'Hide and seek', near ? '' : `Walk closer to ${a.name} first.`, near ? '' : `Walk closer to ${a.name} first!`, () => hs.invite(a))),
      note);
  }

  // ---- 2. the trade bar and the cards' buttons ----
  const nothing = () => el('div', { class: 'tb-card nothing' }, el('span', { class: 'tb-box' }, '📦'), el('b', {}, 'Nothing'));
  function card(item) {
    const P = PARCELS[item.kind], c = item.c;
    return el('div', { class: 'tb-card' }, pic(P.pic(item), 84, 72), el('b', {}, SPECIES[c.species].name), el('span', {}, `Lv ${c.level}`),
      ...(c.traits || []).includes('rideable') ? [el('span', { class: 'trait' }, 'Can be ridden')] : []);
  }

  function bar() {
    const s = S();
    if (!s) return el('div');
    const ready = on => el('span', { class: `tb-ready${on ? ' on' : ''}` }, on ? '✓ Ready' : '...');
    const going = s.state !== 'pick';
    const hint = going ? `Trading with ${s.name}...`
      : s.note || (!s.mine.length && !s.theirs.length ? 'Tap Offer on one of yours below. Nothing back = a present!'
        : s.ready && !s.theirReady ? `Waiting for ${s.name}...` : !s.ready && s.theirReady ? `${s.name} is ready. Are you?` : '');
    return el('div', { class: 'tb' },
      el('h2', {}, `🔁 Trading with ${s.name}`),
      el('div', { class: 'tb-row' },
        el('div', { class: 'tb-side', id: 'tb-mine' }, el('small', {}, 'You give'), s.mine.length ? card(s.mine[0]) : nothing(), ready(s.ready)),
        el('span', { class: 'tb-arrow' }, '⇄'),
        el('div', { class: 'tb-side', id: 'tb-theirs' }, el('small', {}, `${s.name} gives`), s.theirs.length ? card(s.theirs[0]) : nothing(), ready(s.theirReady))),
      el('p', { class: 'tb-note' }, hint),
      el('p', { class: 'tb-btns' },
        el('button', { class: `primary big${s.ready ? ' on' : ''}`, id: 'trade-ready', disabled: going || undefined, onclick: () => game.swaps.setReady(!s.ready) }, s.ready ? 'Not ready' : '✓ Ready!'),
        s.mine.length && !going ? el('button', { class: 'big', id: 'trade-nothing', onclick: () => game.swaps.put(null) }, '📦 Give nothing') : ''));
  }

  function buttons(c, inParty) {
    const s = S();
    if (!s) return [];
    const on = s.mine.some(i => i.c?.uid === c.uid);
    if (on) return [el('button', { class: 'offer on', 'data-offer': c.uid, onclick: () => game.swaps.put(null) }, '✓ Offered (take back)')];
    const last = inParty && canGive(game, [creatureItem(c)]) === 'last';
    return [el('button', { class: `offer${last ? ' dim' : ''}`, 'data-offer': c.uid, onclick: () => game.swaps.put(c) }, last ? 'Stays with you' : '🔁 Offer')];
  }

  const view = { bar, buttons };

  return {
    get isOpen() { return isOpen(); },
    // the friend menu
    menuFor(a) { friend = a; },
    open() { renderMenu(); },
    close() { friend = null; note = null; },
    // the trade screen: ui.tradeView while a trade is on
    view,
    closed() { game.swaps?.closed(); },
    refresh() {
      renderMenu();
      if (game.ui.tradeView && game.ui.partyPanel && !game.ui.partyPanel.classList.contains('hidden')) game.ui.refreshPanel();
    },
  };
}
