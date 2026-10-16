// The three door windows of the Clock Tower, by game time (0 = 06:00 on the HUD clock).
// They cover the whole day, so one door is always open (2 + 2 + 4 real minutes).
export const WINDOWS = {
  morning: { from: 0, to: 0.25, when: 'in the morning', color: 'yellow', wool: 'light' }, // 06:00-12:00
  afternoon: { from: 0.25, to: 0.5, when: 'in the afternoon', color: 'orange', wool: 'fire' }, // 12:00-18:00
  night: { from: 0.5, to: 1, when: 'at night', color: 'dark blue', wool: 'cosmic' }, // 18:00-06:00
};
const frac = t => ((t % 1) + 1) % 1;
export const windowAt = t => (frac(t) < 0.25 ? 'morning' : frac(t) < 0.5 ? 'afternoon' : 'night');
// Whole minutes of real time until window `name` opens (at least 1).
export function minutesUntil(name, t, dayLength) {
  const d = (WINDOWS[name].from - frac(t) + 1) % 1;
  return Math.max(1, Math.ceil(d * dayLength / 60));
}
