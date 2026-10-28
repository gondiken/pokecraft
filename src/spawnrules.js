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
// (T22). A home is a Home { x, y, z, is(type), resultOf(type), spawnSpot() } (T30.5: a home is every type it qualifies
// for): x/y/z = its Doormat, resultOf(type).full = every feature done (a cozy home's 5 hearts), spawnSpot() = a free cell { x, y, z } (integers, y = the air cell above the floor) in or right
// by the home, or null. Only homes within HOME_RANGE of the player count.
export const HOME_RANGE = 32;
// 16:00-22:00 on the HUD clock (game.time 0 = 06:00, 1 = a whole day).
export const isEvening = time => { const t = ((time % 1) + 1) % 1; return t >= 10 / 24 && t < 16 / 24; };
// Share of spawn attempts (one every 0.6 s) while near such a home and none of its creatures is out; T22's HomeType
// may point at these. evening / full multiply the share. `bonus: { feature, step, best }` (T30.5): each `have` above `need` of
// that feature (from the home's result) takes `step` off the '1 in N', never below `best`.
export const HOME_SPAWN = {
  cozy: { share: 1 / 60, evening: 1.5, full: 2, toast: 'Knock knock! A cozy creature came to visit your home.' },
  treasure: { share: 1 / 1500, bonus: { feature: 'gems', step: 40, best: 300 }, toast: 'Something is sparkling at your home... a treasure creature!' },
};
const homeOf = (c, type) => c.homes?.find(h => h.is?.(type));
// The share of spawn attempts for a home type: base share, the bonus (data), evening and full multipliers.
export function homeShare(c, type) {
  const s = HOME_SPAWN[type] || {}, res = homeOf(c, type)?.resultOf?.(type);
  let share = s.share ?? 0;
  if (s.bonus && share > 0) {
    const f = res?.features?.find(x => x.key === s.bonus.feature);
    const extra = f ? Math.max(0, f.have - f.need) : 0;
    share = 1 / Math.min(1 / share, Math.max(s.bonus.best, 1 / share - s.bonus.step * extra)); // never rarer, never above `best`
  }
  return share * (c.evening ? s.evening ?? 1 : 1) * (res?.full ? s.full ?? 1 : 1);
}

/* ==== T36 parkour ==== */
// 'high': Parkour creatures sit up high. `c.perch` (from creatures.context) is a function that finds a treetop, roof or
// pillar near the player ({ x, y, z } = the cell to stand in, or null); there is none underground, in a realm or without
// env. `outdoor`: the creature is not an indoor walker (spawnPlaced). `once`: its toast shows once per play session.
/* ==== end of T36 parkour ==== */
export const CONDITIONS = {
  day: { ok: c => !c.night, text: 'day' },
  night: { ok: c => !!c.night, text: 'night' },
  dawn: { ok: c => c.golden === 'dawn', share: 0.4, max: 3, text: 'at sunrise' },
  dusk: { ok: c => c.golden === 'dusk', share: 0.4, max: 3, text: 'at sunset' },
  together: { ok: c => !!c.friendsNear, share: 1 / 15, max: 1, text: 'with a friend close by',
    toast: 'Bzzt! Playing together woke up a cyber creature nearby!' },
  evening: { ok: c => !!c.evening || !!c.night, text: 'in the evening and at night' }, // T37 ninja
  high: { ok: c => !!c.perch, share: 1 / 30, max: 2, outdoor: true, once: true, // T36
    place: c => c.perch(),
    text: 'up high: on treetops, roofs and tall pillars',
    toast: 'Look up! A sporty creature is on a high spot nearby.' },
  nook: { ok: c => !!c.nook, place: c => c.nook(), outdoor: true, // T40a: Tiny creatures hide in small places
    text: 'hiding in tiny places: in cups, flowers and under leaves' },
  housefloor: { ok: c => !!c.nook, place: c => c.nook(), outdoor: true, // T42: wild Portal creatures live on the floors of the Portal House's calm rooms (world.nooks)
    text: 'in the Portal House: the porch, the Hall of Swirls and the Study' },
  crumbs: { ok: c => !!c.nook && !!c.allCrumbs, place: c => c.nook(), outdoor: true, // T40a.5: Pipsqueak comes out once all 12 crumbs are found
    text: 'in tiny places, once you found all 12 cookie crumbs in the Giant House' },
  // T44: the Surprise Party's wild creatures (T48; the Room of Doors' before) sit in gift boxes in the same kind of spots (by the walls, behind the table): the nook list, a different Book line
  gift: { ok: c => !!c.nook, place: c => c.nook(), outdoor: true, text: 'wrapped in a gift box' },
  // T49: the Castle's wild Knights stand guard at its nooks (the garden, the courtyard, the meadow): the nook list, their own Book line
  guardpost: { ok: c => !!c.nook, place: c => c.nook(), outdoor: true, text: 'on guard at the castle' },
  home: {
    ok: (c, type) => !!homeOf(c, type),
    share: homeShare,
    max: 1,
    place: (c, type) => homeOf(c, type)?.spawnSpot?.() ?? null, // where it appears (instead of a random spot)
    text: type => HOME_SPAWN[type]?.text ?? `near a ${type} home`,
    toast: type => HOME_SPAWN[type]?.toast,
  },
};

// Owner 2026-10-27: the rare creatures of a Picture World wait until you got a bit further there (the 4th element of a spawn
// entry, a Picture World id; wildafter.js checks it). The Book's words for each:
export const AFTER_TEXT = {
  house: 'once you found 6 cookie crumbs',
  race: 'once you beat Racer Rio in a race',
  stadium: 'once you scored 2 goals',
  pirate: 'once you sank 6 rowboats',
  atlantis: 'once you caught 6 glowfish lights',
  fair: 'once you won a golden ticket',
  doors: 'once you won 2 golden bows',
  doodle: 'once you drew 4 lines',
  portal: 'once you finished 4 swirl rooms',
  castle: 'once you won 3 rounds of Shield Up! and the Joust', // T49
};
export const afterOk = (id, ctx) => !id || !!ctx?.after?.(id);

// 'name' or 'name:arg' (T21: 'home:cozy').
export const condOf = s => (s ? CONDITIONS[s.split(':')[0]] : null);
const byArg = (v, s) => (typeof v === 'function' ? v(s.split(':')[1]) : v);
export const condText = s => byArg(condOf(s)?.text, s);
export const condToast = s => byArg(condOf(s)?.toast, s);
export const condOk = (s, ctx) => !s || !!condOf(s)?.ok(ctx, s.split(':')[1]);
