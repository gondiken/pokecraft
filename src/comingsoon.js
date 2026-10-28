// Wave 15's worlds ship closed until the owner opens them (owner 2026-10-27: "don't open them while I'm asleep; I want to play
// them first"). WAVE15_OPEN is the one switch. While it is false the game is exactly as before wave 15 for everyone: the five
// frames stay under cloth, the Funfair gate keeps its "Coming soon!" sign, the Swirl is version 4 (no Portal House) and the
// Pirate Seas version 1 (224 wide, no Sunken City). `?preview` in the page's address opens them on that page only (never
// remembered, so a shared iPad stays closed); tests set `window.__pcWave15`. Node scripts (no `location`) always see them open.
export const WAVE15_OPEN = false;
export const WAVE15 = ['atlantis', 'portal', 'fair', 'doors', 'doodle'];
export const PREVIEW = typeof location !== 'undefined' && new URLSearchParams(location.search).has('preview');
export const wave15Open = WAVE15_OPEN || PREVIEW || typeof location === 'undefined' || globalThis.__pcWave15 === true;
// Owner 2026-10-28: "we can switch on the Funfair in the real game, just that one". A world listed here is open for everyone
// while the rest of wave 15 stays closed.
export const OPEN_NOW = ['fair', 'atlantis', 'doodle', 'doors', 'castle']; // owner 2026-10-28: the Funfair, then Atlantis ("we can switch it on"), then the Surprise Party and the Castle
export const worldOpen = id => wave15Open || OPEN_NOW.includes(id);
// T49 (owner 2026-10-28): the Castle ships behind `?preview` too, until the owner opens it (add 'castle' to OPEN_NOW). While it is closed its
// frame looks exactly like the old secret one (pictureworlds.js), so the cloth spoils nothing.
export const LATER = ['castle'];
