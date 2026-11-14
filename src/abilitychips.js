// Chapter 3 step B: the ONE chip style of a creature's abilities (abilities.js), used on every card: the team screen (and its trade
// mode), the Book's creature and type pages, the trade bar's cards and the creature you are (the HUD, icons only). Walking has no chip.
import { el } from './util.js';
import { ABILITIES, abilitiesOf } from './abilities.js';

// ids -> a row of chips (null when there are none). icons: the HUD's small row (the name stays in the chip's title).
export function abilityChips(ids, { icons = false, cls = '' } = {}) {
  if (!ids?.length) return null;
  return el('div', { class: `abis${icons ? ' icons' : ''}${cls ? ' ' + cls : ''}` }, ...ids.map(id => {
    const a = ABILITIES[id];
    return el('span', { class: 'abi', 'data-ability': id, title: `${a.name}: ${a.line}` }, el('span', { class: 'abi-ico' }, a.icon), icons ? '' : a.name);
  }));
}
// A creature's chips: sp = its SPECIES entry, c = the creature (the guardian's come from its design).
export const creatureChips = (sp, c, opts) => abilityChips(abilitiesOf(sp, c), opts);
