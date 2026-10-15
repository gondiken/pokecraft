// Spawn conditions: the third entry of a SPAWNS entry names one. A condition is plain data plus a test,
// so new ways to be found (T21: near a home of type X) are one more entry here, not new code paths.
//   ok(ctx, arg)  is the condition true now?    share  while ok, this fraction of spawn attempts comes from it
//   max           at most this many alive at once   text   words for the Book   toast  shown when one appears
export const GOLDEN = 60 / 480; // one minute of the 8-minute day, centred on sunrise (time 0) and sunset (0.5)

// 'dawn' or 'dusk' while the golden hour is on, else null. game.time: 0 = sunrise, 0.5 = sunset.
export function goldenHour(time) {
  const t = ((time % 1) + 1) % 1;
  if (t < GOLDEN / 2 || t >= 1 - GOLDEN / 2) return 'dawn';
  return Math.abs(t - 0.5) < GOLDEN / 2 ? 'dusk' : null;
}

export const TOGETHER_RANGE = 30;

export const CONDITIONS = {
  day: { ok: c => !c.night, text: 'day' },
  night: { ok: c => !!c.night, text: 'night' },
  dawn: { ok: c => c.golden === 'dawn', share: 0.4, max: 3, text: 'at sunrise' },
  dusk: { ok: c => c.golden === 'dusk', share: 0.4, max: 3, text: 'at sunset' },
  together: { ok: c => !!c.friendsNear, share: 1 / 15, max: 1, text: 'with a friend close by',
    toast: 'Bzzt! Playing together woke up a cyber creature nearby!' },
};

// 'name' or 'name:arg' (T21: 'home:cozy').
export const condOf = s => (s ? CONDITIONS[s.split(':')[0]] : null);
export const condOk = (s, ctx) => !s || !!condOf(s)?.ok(ctx, s.split(':')[1]);
