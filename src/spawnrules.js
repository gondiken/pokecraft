// Spawn conditions: the third entry of a SPAWNS entry names one. A condition is plain data plus a test,
// so new ways to be found (T21: near a home of type X) are one more entry here, not new code paths.
//   ok(ctx, arg)  is the condition true now?    share  while ok, this fraction of spawn attempts comes from it
//                 (a number, or (ctx, arg) => number)
//   max           at most this many alive at once   text   words for the Book   toast  shown when one appears
//                 (text and toast: a string, or arg => string)
//   place(ctx, arg)  optional: { x, y, z } where it appears instead of a random spot (null = no spawn this time)
export const GOLDEN = 60 / 480; // one minute of the 8-minute day, centred on sunrise (time 0) and sunset (0.5)

// 'dawn' or 'dusk' while the golden hour is on, else null. game.time: 0 = sunrise, 0.5 = sunset.
export function goldenHour(time) {
  const t = ((time % 1) + 1) % 1;
  if (t < GOLDEN / 2 || t >= 1 - GOLDEN / 2) return 'dawn';
  return Math.abs(t - 0.5) < GOLDEN / 2 ? 'dusk' : null;
}

export const TOGETHER_RANGE = 30;

// T21: Cozy and Treasure creatures only come to a finished home of their type. Homes come from creatures.env.homes()
// (T22). A home is { type, x, y, z, full, spawnSpot() }: x/y/z = its Doormat, full = every feature done (a cozy
// home's 5 hearts), spawnSpot() = a free cell { x, y, z } (integers, y = the air cell above the floor) in or right
// by the home, or null. Only homes within HOME_RANGE of the player count.
export const HOME_RANGE = 32;
// 16:00-22:00 on the HUD clock (game.time 0 = 06:00, 1 = a whole day).
export const isEvening = time => { const t = ((time % 1) + 1) % 1; return t >= 10 / 24 && t < 16 / 24; };
// Share of spawn attempts (one every 0.6 s) while near such a home and none of its creatures is out; T22's HomeType
// may point at these. evening / full multiply the share.
export const HOME_SPAWN = {
  cozy: { share: 1 / 60, evening: 1.5, full: 2, toast: 'Knock knock! A cozy creature came to visit your home.' },
  treasure: { share: 1 / 1500, toast: 'Something is sparkling at your home... a treasure creature!' },
};
const homeOf = (c, type) => c.homes?.find(h => h.type === type);

export const CONDITIONS = {
  day: { ok: c => !c.night, text: 'day' },
  night: { ok: c => !!c.night, text: 'night' },
  dawn: { ok: c => c.golden === 'dawn', share: 0.4, max: 3, text: 'at sunrise' },
  dusk: { ok: c => c.golden === 'dusk', share: 0.4, max: 3, text: 'at sunset' },
  together: { ok: c => !!c.friendsNear, share: 1 / 15, max: 1, text: 'with a friend close by',
    toast: 'Bzzt! Playing together woke up a cyber creature nearby!' },
  home: {
    ok: (c, type) => !!homeOf(c, type),
    share: (c, type) => {
      const s = HOME_SPAWN[type] || {};
      return (s.share ?? 0) * (c.evening ? s.evening ?? 1 : 1) * (homeOf(c, type)?.full ? s.full ?? 1 : 1);
    },
    max: 1,
    place: (c, type) => homeOf(c, type)?.spawnSpot?.() ?? null, // where it appears (instead of a random spot)
    text: type => `near a ${type} home`,
    toast: type => HOME_SPAWN[type]?.toast,
  },
};

// 'name' or 'name:arg' (T21: 'home:cozy').
export const condOf = s => (s ? CONDITIONS[s.split(':')[0]] : null);
const byArg = (v, s) => (typeof v === 'function' ? v(s.split(':')[1]) : v);
export const condText = s => byArg(condOf(s)?.text, s);
export const condToast = s => byArg(condOf(s)?.toast, s);
export const condOk = (s, ctx) => !s || !!condOf(s)?.ok(ctx, s.split(':')[1]);
