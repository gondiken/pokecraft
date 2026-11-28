// Owner 2026-11-28 ("game icons can ideally be sth you draw ... rather than lame emojis"): the friend menu's pictures, drawn as SVG in the
// same sticker style as the ability badges (abilityicons.js): a rounded tile in the game's colour, a white picture outlined in ink.
// Pure (no imports). `friendSvg(id, px)` -> an <svg> string, '' for an unknown id (the menu then shows the kind's emoji).
const INK = '#1b1d26';
const W = `fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const F = c => `fill="${c}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`; // a coloured shape, inked
const K = (w = 2.2) => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const S = (w = 3) => `fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const line = (d, w = 3.2) => `<path d="${d}" ${K(w + 3.2)}/><path d="${d}" ${S(w)}/>`; // a white line with an ink edge
const eye = (x, y, r = 1.8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;

export const FRIEND_ART = {
  battle: { bg: '#e0503c', art: // two little creatures face to face, a spark between them
    `<path d="M3 40V25C3 19 7 16 12 16C17 16 20 19 20 25V40Z" ${W}/>` + eye(14, 25) + `<path d="M5 17L7 11L11 15.5" ${W}/>`
    + `<path d="M45 40V25C45 19 41 16 36 16C31 16 28 19 28 25V40Z" ${F('#ffd34a')}/>` + eye(34, 25) + `<path d="M43 17L41 11L37 15.5" ${F('#ffd34a')}/>`
    + `<path d="M25 9L21 22H26L22 33L30 18H25L28 9Z" ${F('#fff6b0')}/>` },
  trade: { bg: '#2f9a7a', art: // two arrows going round: give one, get one
    `<path d="M9 21C10 13 16 8 24 8C30 8 34 11 37 15" ${K(8)}/><path d="M9 21C10 13 16 8 24 8C30 8 34 11 37 15" ${S(4.4)}/>`
    + `<path d="M31 17L41 19L40 9Z" ${W}/>`
    + `<path d="M39 27C38 35 32 40 24 40C18 40 14 37 11 33" ${K(8)}/><path d="M39 27C38 35 32 40 24 40C18 40 14 37 11 33" ${S(4.4)}/>`
    + `<path d="M17 31L7 29L8 39Z" ${W}/>` },
  hide: { bg: '#3c9a40', art: // a round bush with two eyes peeking out
    `<path d="M5 42C2 34 6 27 12 27C11 19 18 14 24 17C29 11 39 14 39 22C45 23 47 32 43 42Z" ${F('#7ad060')}/>`
    + `<path d="M12 33C14 31 16 31 18 33M30 36C32 34 34 34 36 36" ${K(1.8)}/>`
    + `<ellipse cx="21" cy="27" rx="3.2" ry="3.6" ${W}/><ellipse cx="29" cy="27" rx="3.2" ry="3.6" ${W}/>` + eye(21.6, 27.6, 1.5) + eye(29.6, 27.6, 1.5) },
  tag: { bg: '#e07a1c', art: // a runner, tapped on the back by a hand: "you're it!"
    `<circle cx="34" cy="9" r="4" ${W}/>` + line('M32 13.5L29 23M29 23L35 27L35 34M29 23L23 27L21 33M31 16L38 19L42 16M31 16L25 18', 3)
    + `<path d="M3 21C3 18.5 5 17 7.5 17H17L19.5 15.2C21 14.2 23 15.2 23 17V25C23 27 21 28 19.5 27L17 25H7.5C5 25 3 23.5 3 21Z" ${W}/>`
    + `<path d="M8 20H15M8 22.5H15" ${K(1.4)}/>` + line('M25 9L23 6M26 31L24 34M22 21H19', 2) },
  football: { bg: '#2e8a3e', art: // a ball flying into a goal net
    `<path d="M22 6H45V40H22" ${K(6)}/><path d="M22 6H45V40H22" ${S(3)}/>`
    + `<path d="M27 11V36M33 11V36M39 11V36M26 16H43M26 23H43M26 30H43" stroke="#fff" stroke-width="1.2" opacity=".6"/>`
    + `<circle cx="14" cy="31" r="10" ${W}/><path d="M14 26.5L18.3 29.6L16.7 34.6H11.3L9.7 29.6Z" fill="${INK}"/>`
    + `<path d="M14 26.5V21.2M18.3 29.6L23.4 28M16.7 34.6L19.8 39M11.3 34.6L8.2 39M9.7 29.6L4.6 28" ${K(1.6)}/>` },
  hoops: { bg: '#3a64c8', art: // an orange ball dropping into a hoop with a net
    `<rect x="26" y="4" width="18" height="14" rx="1.5" ${W}/><rect x="31" y="9" width="8" height="6" ${K(1.8)}/>`
    + `<path d="M22 20H40" ${K(3.4)}/><path d="M23 20L26 31H36L39 20M27 20L29.5 31M35 20L32.5 31M24.5 25.5H37.5" ${S(1.8)}/>`
    + `<circle cx="14" cy="17" r="10" ${F('#ff8a2a')}/><path d="M4 17H24M14 7V27M7 10C11 13 11 21 7 24M21 10C17 13 17 21 21 24" ${K(1.6)}/>`
    + line('M8 34L5 40M14 33L13 40', 2.2) },
  race: { bg: '#c8343c', art: // a little kart and a chequered flag
    `<path d="M28 4V26" ${K(2.8)}/><path d="M28 5H45V17H28Z" ${W}/>`
    + `<path d="M28 5H32.25V9H28ZM36.5 5H40.75V9H36.5ZM32.25 9H36.5V13H32.25ZM40.75 9H45V13H40.75ZM28 13H32.25V17H28ZM36.5 13H40.75V17H36.5Z" fill="${INK}"/>`
    + `<path d="M4 34L8 26H20L24 22H29L31 30H40L42 34Z" ${F('#ffd34a')}/>`
    + `<circle cx="11" cy="37" r="5" ${W}/><circle cx="35" cy="37" r="5" ${W}/>` + eye(11, 37, 1.4) + eye(35, 37, 1.4)
    + `<circle cx="22" cy="20" r="4" ${W}/>` },
  parkour: { bg: '#7a4ad0', art: // a runner leaping from block to block
    `<rect x="2" y="34" width="13" height="12" ${F('#cfc6f0')}/><rect x="32" y="26" width="14" height="20" ${F('#cfc6f0')}/>`
    + `<path d="M8 28C14 12 28 8 38 16" stroke="#fff" stroke-width="1.8" stroke-dasharray="2.5 3" fill="none" opacity=".9"/>`
    + `<circle cx="25" cy="8.5" r="4" ${W}/>`
    + line('M23 13L19 22M19 22L26 25L28 31M19 22L13 25L10 21M22 15L29 16L33 13M22 15L16 13L14 9', 3) },
  bounce: { bg: '#a052c8', art: // a shine ball bouncing off a flat mirror (angle in = angle out)
    `<path d="M6 5L23 29L39 7" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="3.2 3"/>`
    + `<circle cx="39" cy="8" r="5" ${F('#fff6b0')}/>`
    + `<rect x="4" y="31" width="40" height="9" rx="2.5" ${F('#a8dcff')}/><path d="M10 39L15 32M17 39L22 32M30 39L33 34.5" ${S(2)}/>`
    + `<rect x="2" y="40" width="44" height="4" rx="1.5" ${F('#e8c060')}/>` + line('M23 25V21M19 26L17 24M27 26L29 24', 1.8) },
  bumper: { bg: '#e04a8a', art: // a round bumper car with a balloon tied to its back
    `<path d="M33 4C39 4 42 8 42 12C42 17 38 20 36 21C34 20 29 17 29 12C29 8 31 4 33 4Z" ${F('#ffd34a')}/><path d="M36 21C35 26 37 28 34 33" ${K(1.6)}/>`
    + `<path d="M3 36C3 30 8 27 14 27H33C39 27 44 30 44 36C44 40 41 42 37 42H10C6 42 3 40 3 36Z" ${F('#4fb4f0')}/>`
    + `<path d="M3 36C3 39 6 42 10 42H37C41 42 44 39 44 36" ${K(4.5)}/><path d="M3 36C3 39 6 42 10 42H37C41 42 44 39 44 36" stroke="#fff" stroke-width="2" fill="none"/>`
    + `<circle cx="17" cy="21" r="4.5" ${W}/><path d="M14 27H20V30H14Z" ${W}/><ellipse cx="25" cy="28" rx="3.2" ry="1.6" ${W}/>` },
};

let made = 0;
export function friendSvg(id, px = 44) {
  const a = FRIEND_ART[id];
  if (!a) return '';
  const clip = `fgclip${made++}`;
  return `<svg class="fm-svg" viewBox="0 0 48 48" width="${px}" height="${px}" aria-hidden="true">`
    + `<defs><clipPath id="${clip}"><rect x="1" y="1" width="46" height="46" rx="11"/></clipPath></defs>`
    + `<rect x="1" y="1" width="46" height="46" rx="11" fill="${a.bg}"/>`
    + `<g clip-path="url(#${clip})"><path d="M5 13Q5 5 13 5H35Q43 5 43 13V15H5Z" fill="#fff" opacity=".16"/>${a.art}</g>`
    + `<rect x="1" y="1" width="46" height="46" rx="11" fill="none" stroke="${INK}" stroke-width="2"/></svg>`;
}
