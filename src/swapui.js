// Wave 17: the Swap panel (#swap): pick a creature (or Nothing: a present) to trade, the last yes, waiting, and creatures on their way.
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

  const NOTHING = { nothing: true }; // the "Nothing" tile: a trade with nothing from this side is a present
  const name = c => SPECIES[c.species].name;

  function tile(c, where) {
    const v = game.swaps.view, theirs = game.swaps.theirs;
    const presentFromMe = v?.mode === 'pick' && !theirs?.give.length; // nothing comes back: my last team creature must stay
    const why = canGive(game, [creatureItem(c)]) === 'last' && (v?.mode !== 'pick' || presentFromMe) ? 'Keep one friend in your team!' : '';
    return el('button', {
      class: `swap-tile${picked === c ? ' on' : ''}${why ? ' dim' : ''}`, 'data-uid': c.uid, 'data-where': where,
      onclick: () => { if (why) { if (note) note.textContent = why; return; } picked = c; render(); },
    }, pic(c.species), el('span', { class: 'st-name' }, name(c)), el('span', { class: 'st-lv' }, `Lv ${c.level}`));
  }

  function nothingTile() {
    return el('button', { class: `swap-tile nothing${picked === NOTHING ? ' on' : ''}`, 'data-uid': 'nothing', onclick: () => { picked = NOTHING; render(); } },
      el('span', { class: 'st-box' }, '📦'), el('span', { class: 'st-name' }, 'Nothing'), el('span', { class: 'st-lv' }, '(a present)'));
  }

  // The bar over the tiles: what the big button will do.
  function bar(v) {
    if (!picked) return '';
    const theirs = game.swaps.theirs, offered = theirs?.give[0];
    let text, word;
    if (v.mode === 'offer') {
      [text, word] = picked === NOTHING ? [`Ask ${v.friend} for a present?`, '🔁 Ask!'] : [`Offer ${name(picked)} to ${v.friend}?`, '🔁 Offer!'];
    } else if (picked === NOTHING) {
      [text, word] = [`Take ${offered ? PARCELS[offered.kind].name(offered) : 'it'} as a present?`, '🎁 Thank you!'];
    } else {
      [text, word] = offered ? [`Swap your ${name(picked)} for it?`, '🔁 Swap!'] : [`Give ${name(picked)} to ${v.friend} as a present?`, '🎁 Give!'];
    }
    return el('div', { class: 'swap-bar' }, picked === NOTHING ? el('span', { class: 'st-box' }, '📦') : pic(picked.species, 70, 60), el('span', {}, text),
      el('button', { class: 'primary big', id: 'swap-go', onclick: () => { const c = picked; picked = null; game.swaps.choose(c === NOTHING ? null : c); } }, word));
  }

  function chooser(v) {
    const theirs = game.swaps.theirs;
    const head = v.mode === 'offer'
      ? [el('h2', {}, `🔁 Trade with ${v.friend}`), el('p', { class: 'swap-sub' }, `What do you give? ${v.friend} picks one back.`)]
      : [el('h2', {}, theirs?.give.length ? `🔁 ${v.friend} offers` : `🔁 ${v.friend} would love a present`),
        ...(theirs?.give.length ? [card(theirs.give[0])] : []),
        el('p', { class: 'swap-sub' }, theirs?.give.length ? 'Pick one back, or Nothing to keep it as a present.' : 'Pick one to give.')];
    note = el('p', { class: 'swap-note' }, '');
    const canNothing = v.mode === 'offer' || !!theirs?.give.length;
    return [...head, bar(v), note,
      el('h3', {}, 'Your team'), el('div', { class: 'swap-tiles' }, ...(canNothing ? [nothingTile()] : []), ...game.party.map(c => tile(c, 'party'))),
      ...(game.box.length ? [el('h3', {}, 'Storage Box'), el('div', { class: 'swap-tiles' }, ...game.box.map(c => tile(c, 'box')))] : [])];
  }

  const nothingCard = () => el('div', { class: 'swap-card' }, el('span', { class: 'st-box' }, '📦'), el('b', {}, 'Nothing'));

  function decide() {
    const m = game.swaps.mine;
    if (!m || !(m.get.length + m.give.length)) return [el('p', {}, '...')];
    const title = !m.get.length ? `🔁 ${m.name} gives nothing back` : !m.give.length ? `🎁 ${m.name} gives you a present!` : `🔁 ${m.name} offers`;
    const word = !m.get.length ? '🎁 Give it anyway!' : !m.give.length ? '🎁 Thank you!' : '🔁 Swap!';
    return [el('h2', {}, title),
      el('div', { class: 'swap-pair' }, m.get.length ? card(m.get[0]) : nothingCard(), el('span', { class: 'swap-arrow' }, 'for your'), m.give.length ? card(m.give[0]) : nothingCard()),
      el('p', { class: 'swap-btns' },
        el('button', { class: 'primary big', id: 'swap-yes', onclick: () => game.swaps.yes() }, word),
        el('button', { class: 'big', id: 'swap-no', onclick: () => game.swaps.no() }, 'No thanks'))];
  }

  // Creatures in escrow: on the way until the friend's game says it got them.
  function onTheWay() {
    const out = Object.values(game.swaps.ledger.out).filter(e => e.give.length); // asking for a present sends nothing away
    if (!out.length) return [];
    return [el('h3', {}, 'On the way'), ...out.map(e => el('div', { class: 'swap-way' }, pic(PARCELS[e.give[0].kind].pic(e.give[0]), 56, 48),
      `${e.give.map(i => PARCELS[i.kind].label(i)).join(', ')} → ${e.name || 'a friend'}. Play together again to finish!`))];
  }

  function render() {
    if (!isOpen()) return;
    const v = game.swaps.view;
    let parts;
    if (!v) parts = [el('h2', {}, 'Trades'), el('p', {}, 'Play together with a friend, then open the pause screen to trade.')];
    else if (v.mode === 'offer' || v.mode === 'pick') parts = chooser(v);
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
