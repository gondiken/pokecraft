// The Custom type's pure rules (no imports): the twelve paints, the six designs, and the tiny `paint` field a designed creature
// carries (plans/wave19-wizard-tower.md sections 4.1 and 8.3). `PAINTS` is append-only: the index is what a creature saves.

// i: the saved number; wool: the type name of the plain wool block it is (blocks.js `WOOL`); hex: the same colour as `WOOL_RGB`.
export const PAINTS = [
  { code: 'r', name: 'Red', wool: 'parkour', hex: 0xe13c3c },
  { code: 'o', name: 'Orange', wool: 'racer', hex: 0xff963c },
  { code: 'y', name: 'Yellow', wool: 'electric', hex: 0xf0c828 },
  { code: 'g', name: 'Green', wool: 'grass', hex: 0x50aa46 },
  { code: 't', name: 'Teal', wool: 'sound', hex: 0x3cc8b4 },
  { code: 'i', name: 'Sky Blue', wool: 'ice', hex: 0x96dceb },
  { code: 'b', name: 'Blue', wool: 'water', hex: 0x3c6edc },
  { code: 'p', name: 'Purple', wool: 'toxic', hex: 0x8c46b4 },
  { code: 'k', name: 'Pink', wool: 'pixie', hex: 0xffafdc },
  { code: 'n', name: 'Brown', wool: 'rock', hex: 0xa08250 },
  { code: 'm', name: 'Grey', wool: 'metal', hex: 0xaab4be },
  { code: 'x', name: 'Black', wool: 'ninja', hex: 0x2e2842 },
];
export const WASH = -1; // the wash jar: a square back to blank canvas
export const DESIGNS = ['brushtail', 'palettoad', 'inkwing', 'crayonix', 'framesaur', 'blotbun']; // board order
export const PAINT_SLOTS = 3; // body, accent, belly

const isIndex = n => Number.isInteger(n) && n >= 0 && n < PAINTS.length;

// A design's colours from three paint indices. `dark` is the body, much darker.
const shade = (hex, f) => (Math.round(((hex >> 16) & 255) * f) << 16) | (Math.round(((hex >> 8) & 255) * f) << 8) | Math.round((hex & 255) * f);
export function paintColours(paint) {
  const [b, a, l] = paint;
  return { body: PAINTS[b].hex, accent: PAINTS[a].hex, belly: PAINTS[l].hex, dark: shade(PAINTS[b].hex, 0.45) };
}
// `model` with the paint's four colours (a new object; the species' own model is never changed).
export const paintModel = (model, paint) => (paint ? { ...model, ...paintColours(paint) } : model);

// The cleaned triple for a designed species (any bad entry -> that design's default); undefined for every other species.
export function cleanPaint(list, species, SPECIES) {
  const sp = SPECIES?.[species];
  if (!sp?.designed) return undefined;
  const base = sp.defaultPaint;
  return Array.from({ length: PAINT_SLOTS }, (_, i) => (Array.isArray(list) && isIndex(list[i]) ? list[i] : base[i]));
}
// Cleans a list of creatures in place (a designed one gets a clean `paint`, any other loses it); returns the list.
export function fixPaint(list, SPECIES) {
  for (const c of Array.isArray(list) ? list : []) {
    if (!c || typeof c !== 'object') continue;
    const p = cleanPaint(c.paint, c.species, SPECIES);
    if (p) c.paint = p; else delete c.paint;
  }
  return list;
}
// Your guardian's level: your best creature - 5, at least 50, at most the top level.
export function guardianLevel(party, maxLevel = 100) {
  const best = Math.max(0, ...(party || []).map(c => c.level | 0));
  return Math.min(maxLevel, Math.max(50, best - 5));
}
