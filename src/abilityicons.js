// Chapter 3 step B (owner 2026-11-14: "design the ability images yourself and not use emojis"): the 19 ability badges, drawn as SVG, pure
// (no imports). Each is a rounded tile in the ability's own colour with a white sticker picture outlined in ink, readable at 20 px on an
// iPad and big on the drawing board. `abilitySvg(id, px)` -> an <svg> string; ABILITY_ART[id].bg is the tile colour.
const INK = '#1b1d26';
const W = `fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const S = (w = 3) => `fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`; // a white line
const K = (w = 2.2) => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`; // an ink line
// a white line with an ink edge (drawn twice)
const line = (d, w = 3.4) => `<path d="${d}" ${K(w + 3.2)}/><path d="${d}" ${S(w)}/>`;
const spark = (x, y, r = 3.5) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#fff"/>`;

export const ABILITY_ART = {
  fly: { bg: '#4f9df0', art: // a feathered wing and a gust under it
    `<path d="M9 31C13 16 27 8 41 9C39 13 35 15 31 16C35 17 37 19 37 21C33 23 29 23 26 23C29 25 30 27 29 29C22 32 15 32 9 31Z" ${W}/>`
    + `<path d="M17 27L27 20M22 21L32 14" ${K(1.8)}/>` + line('M7 39H20M25 39H33', 2.6) },
  swim: { bg: '#1f78c8', art: // a curling wave rushing along, bubbles
    `<path d="M7 34C10 26 16 22 22 24C19 17 25 10 34 11C40 12 43 17 42 22C38 18 32 19 32 24C32 28 36 30 41 29L42 36H7Z" ${W}/>`
    + line('M3 17H11M5 24H10', 2.6) + `<circle cx="38" cy="5.5" r="2.4" ${W}/><circle cx="44" cy="10" r="1.6" fill="#fff"/>` },
  climb: { bg: '#b06a34', art: // a sheer cliff with holds and the way up
    `<path d="M27 3H45V45H27C29 36 25 30 28 22C30 15 26 9 27 3Z" fill="#7a4520" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<ellipse cx="33" cy="11" rx="3.2" ry="2.4" ${W}/><ellipse cx="37" cy="22" rx="3.2" ry="2.4" ${W}/><ellipse cx="33" cy="33" rx="3.2" ry="2.4" ${W}/>`
    + line('M14 42V12') + line('M7.5 19L14 11L20.5 19') },
  dig: { bg: '#8a5a2b', art: // a spade in a heap of earth
    `<path d="M3 44C8 33 20 30 28 35C34 31 42 34 45 44Z" fill="#5a3818" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<circle cx="12" cy="40" r="1.6" fill="#c89a5a"/><circle cx="38" cy="40" r="1.6" fill="#c89a5a"/>` + line('M31 6L23 30', 3.2) + line('M26 6.5L36 9.5', 3.2)
    + `<path d="M16 28L28 32.5L24.5 41C20 42.5 14.5 40 15 34.5Z" ${W}/>` },
  squeeze: { bg: '#8d6fd4', art: // two stones, a thin crack between them, something flat slipping in
    `<rect x="3" y="5" width="17" height="38" rx="3" fill="#cfc6e4" stroke="${INK}" stroke-width="2.2"/><rect x="28" y="5" width="17" height="38" rx="3" fill="#cfc6e4" stroke="${INK}" stroke-width="2.2"/>`
    + `<rect x="21.6" y="11" width="4.8" height="26" rx="2.4" ${W}/><circle cx="24" cy="17" r="1.1" fill="${INK}"/>`
    + `<path d="M7 24H15M12 20.5L15.5 24L12 27.5M41 24H33M36 20.5L32.5 24L36 27.5" ${K(2.4)}/>` },
  pass: { bg: '#5d4fb8', art: // a ghost half through a faded, half-erased wall
    `<path d="M11 39V22C11 14 17 9 24 9C31 9 37 14 37 22V39L33 35L29 39L25 35L21 39L17 35Z" ${W}/>`
    + `<circle cx="19.5" cy="22" r="2.4" fill="${INK}"/><circle cx="28.5" cy="22" r="2.4" fill="${INK}"/>`
    + `<rect x="21" y="3" width="6" height="42" fill="#b8b0f0" opacity=".55"/><path d="M24 3V45" stroke="#fff" stroke-width="2.2" stroke-dasharray="4 3.5" opacity=".9"/>` },
  glow: { bg: '#f0a020', art: // a bright bulb with rays
    line('M24 2.5V6.5M9 8L12 11M39 8L36 11M3.5 20H7.5M40.5 20H44.5', 2.8)
    + `<circle cx="24" cy="20" r="11" fill="#fff6b0" stroke="${INK}" stroke-width="2.4"/><path d="M19.5 22L21.75 17.5L24 22L26.25 17.5L28.5 22" ${K(1.8)}/>`
    + `<rect x="18.5" y="30" width="11" height="9" rx="2" ${W}/><path d="M18.5 33.5H29.5M18.5 36.5H29.5" ${K(1.6)}/><path d="M21 39L24 43L27 39" ${W}/>` },
  burn: { bg: '#f05020', art: // a flame
    `<path d="M24 3C30 11 38 17 38 28C38 37 31 44 24 44C17 44 10 37 10 28C10 21 15 17 17 11C19 16 21 19 23 19C22 13 22 8 24 3Z" fill="#ffd34a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<path d="M24 24C28 28 31 31 31 35.5C31 39.5 28 42 24 42C20 42 17 39.5 17 35.5C17 31 20 28 24 24Z" fill="#fff"/>` },
  freeze: { bg: '#3ab8e0', art: // a snowflake
    [0, 60, 120, 180, 240, 300].map(a => `<g transform="rotate(${a} 24 24)"><path d="M24 24V5M18.5 9.5L24 14.5L29.5 9.5" ${K(6.2)}/></g>`).join('')
    + [0, 60, 120, 180, 240, 300].map(a => `<g transform="rotate(${a} 24 24)"><path d="M24 24V5M18.5 9.5L24 14.5L29.5 9.5" ${S(3)}/></g>`).join('')
    + `<circle cx="24" cy="24" r="3.6" ${W}/>` },
  zap: { bg: '#e8b400', art: // a lightning bolt
    `<path d="M29 3L10 27H22L18 45L38 19H26Z" ${W}/>` + spark(41, 36, 3.5) + spark(8, 11, 2.8) },
  sprint: { bg: '#ff7a2a', art: // a running shoe with speed lines
    `<path d="M10 31C10 25 13 20 17 20L22.5 22.5C26 22.5 28.5 20.5 30.5 18L34.5 22C38 25.5 43 27 43 31.5V34H10Z" ${W}/>`
    + `<rect x="9" y="33" width="35" height="6" rx="2.5" fill="#ffd0a8" stroke="${INK}" stroke-width="2.2"/>`
    + `<path d="M21.5 23.5L23.5 27.5M25.5 23L27.5 27M29.5 21.5L31.5 25.5" ${K(1.8)}/>` + line('M2 21H9M3.5 28H8', 2.6) },
  rewind: { bg: '#25a89a', art: // a clock with the time turning back
    `<circle cx="24" cy="28" r="13.5" ${W}/><path d="M24 28V19.5M24 28L30 31.5" ${K(3)}/><circle cx="24" cy="28" r="1.8" fill="${INK}"/>`
    + line('M38 13C32 5 16 5 11 13', 3) + line('M10 5.5V13.5H18', 3) },
  push: { bg: '#6a7c94', art: // a big arrow shoving a boulder along
    `<circle cx="31" cy="27" r="13" fill="#d8d0c0" stroke="${INK}" stroke-width="2.4"/><ellipse cx="26" cy="22" rx="3" ry="2" fill="#b0a690"/><ellipse cx="35" cy="31" rx="3.5" ry="2.4" fill="#b0a690"/><ellipse cx="28" cy="34" rx="2" ry="1.4" fill="#b0a690"/>`
    + `<path d="M3 22H10V16L18 27L10 38V32H3Z" ${W}/>` + line('M7 44H40', 2.4) },
  sneak: { bg: '#3a3f78', art: // a masked pair of eyes peeking over a bush
    `<rect x="9" y="14" width="30" height="12" rx="6" fill="${INK}"/>`
    + `<ellipse cx="18" cy="20" rx="5" ry="3.8" fill="#fff"/><ellipse cx="30" cy="20" rx="5" ry="3.8" fill="#fff"/><circle cx="20.2" cy="20" r="2" fill="${INK}"/><circle cx="32.2" cy="20" r="2" fill="${INK}"/>`
    + `<path d="M3 45C3 35 9 30 15 32C17 25 31 25 33 32C39 30 45 35 45 45Z" fill="#4c9a3c" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<path d="M14 38Q17 35 20 38M28 38Q31 35 34 38" ${K(1.6)}/>` },
  lift: { bg: '#c04cc0', art: // a box floating up out of reach, lifted by a glow
    `<path d="M24 7L36 13L24 19L12 13Z" ${W}/><path d="M12 13L24 19V31L12 25Z" fill="#f0e0f8" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M36 13L24 19V31L36 25Z" fill="#d8b8e8" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<ellipse cx="24" cy="41" rx="13" ry="3.6" fill="#fff" opacity=".55"/><path d="M15 37Q13 35 15 33M24 38.5Q22 36.5 24 34.5M33 37Q31 35 33 33" ${S(2)}/>` + spark(8, 8) + spark(41, 31, 3) },
  charm: { bg: '#f0508e', art: // a heart with sparkles
    `<path d="M24 41C10 31 6 24 6 17C6 11 11 7 16 7C20 7 23 10 24 13C25 10 28 7 32 7C37 7 42 11 42 17C42 24 38 31 24 41Z" ${W}/>`
    + `<path d="M13 15Q14 11.5 18 11" ${K(2.2)}/>` + spark(41, 37, 4) + spark(7, 35, 3) },
  sense: { bg: '#1f9a8a', art: // an echo spreading out, and the hidden path it shows
    `<circle cx="9" cy="24" r="4.2" ${W}/>` + line('M14.5 15.5A10 10 0 0 1 14.5 32.5', 3) + line('M18.5 9.5A17 17 0 0 1 18.5 38.5', 3)
    + `<path d="M23.5 4A24 24 0 0 1 23.5 44" fill="none" stroke="#fff" stroke-width="2.6" stroke-dasharray="3.5 3.5" stroke-linecap="round"/>`
    + `<circle cx="32" cy="32" r="2" fill="#fff"/><circle cx="37" cy="27" r="2" fill="#fff"/><circle cx="42" cy="22" r="2" fill="#fff"/>` },
  grow: { bg: '#3fa83a', art: // a sprout splitting a cracked stone
    `<path d="M5 45L9 31L21 27L37 29L43 45Z" fill="#b8b8b0" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 45L26.5 37L22 33L24 28" ${K(2.2)}/>`
    + line('M24 28V13', 2.6)
    + `<path d="M24 17C18 17 13 13 12 7C18 7 23 10 24 17Z" ${W}/><path d="M24 14C28 13 33 9 36 5C30 4 25 7 24 14Z" ${W}/>` },
  heal: { bg: '#22b47a', art: // a plus, half scribbled grey, half back in colour
    `<path d="M19 7H29V19H41V29H29V41H19V29H7V19H19Z" ${W}/>`
    + `<path d="M10 21.5L16 26.5M12 20L20 27M19 9L22 14M19 14L22 18.5M19 30L23 36M19 35L21 38" stroke="#9a9aa0" stroke-width="1.8" stroke-linecap="round"/>`
    + spark(41, 8, 4) + spark(37, 40, 3) },
};

let made = 0; // each <svg> gets its own clip id (the art stays inside the rounded tile)
export function abilitySvg(id, px = 24) {
  const a = ABILITY_ART[id];
  if (!a) return '';
  const clip = `abiclip${made++}`;
  return `<svg class="abi-svg" viewBox="0 0 48 48" width="${px}" height="${px}" aria-hidden="true">`
    + `<defs><clipPath id="${clip}"><rect x="1" y="1" width="46" height="46" rx="11"/></clipPath></defs>`
    + `<rect x="1" y="1" width="46" height="46" rx="11" fill="${a.bg}"/>`
    + `<g clip-path="url(#${clip})"><path d="M5 13Q5 5 13 5H35Q43 5 43 13V15H5Z" fill="#fff" opacity=".16"/>${a.art}</g>`
    + `<rect x="1" y="1" width="46" height="46" rx="11" fill="none" stroke="${INK}" stroke-width="2"/></svg>`;
}
