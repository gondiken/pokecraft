// "Glows faster the closer you get": one rule for every HUD hint that blinks with distance (the Treasure Vault's key,
// the Restaurant's ingredients, the hide-and-seek compass). A Glint turns a distance into seconds per glint; the HUD
// writes that into the CSS variable --glint, which the `key-glint` animation (style.css) reads.
export class Glint {
  // scale: blocks per extra second; min / max: the fastest and slowest glint in seconds; base: seconds at distance 0.
  constructor({ scale = 12, min = 0.35, max = 3, base = 0.3 } = {}) {
    this.scale = scale;
    this.min = min;
    this.max = max;
    this.base = base;
  }

  // Seconds per glint for something `dist` blocks away.
  period(dist) { return Math.min(this.max, Math.max(this.min, this.base + dist / this.scale)); }

  // Periods are shown to a tenth of a second, so the HUD only redraws when the shown speed changes.
  static tag(period) { return Math.round(period * 10); }

  // Gives an element this glint speed (its CSS animation uses var(--glint)).
  static show(el, period) { el.style.setProperty('--glint', `${(Glint.tag(period) / 10).toFixed(1)}s`); }
}

export const NEAR = new Glint(); // things that stay put: golden keys, ingredients
export const SEEK = new Glint({ scale: 16 }); // hide and seek: a friend who moves, so it reacts over a longer distance
