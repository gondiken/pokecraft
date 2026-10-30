// Starting a Picture World over (owner 2026-10-29). Two small, generic pieces:
//  1. ONE-TIME RESETS (`WORLD_RESETS`): a save that loads without a world's mark key gets that world's old progress cleared once (its
//     `pw:<id>:*` keys incl. the crew, its star, its `bossWins` entry), then the mark is added, so everything won later is kept forever.
//     Only ever for a world that was preview-only until then (nobody else could have played it): the Bubble Well's redesign
//     (2026-10-29, owner: "reset my progress in ... bubble worlds") is the first. A new game gets every mark at once (nothing to clear).
//     The marks live in `beaten` like every Picture World key ('pw:<id>:<name>'); this file never clears a mark.
//  2. "Start this world over" in the pause screen, ONLY with ?preview (comingsoon.js PREVIEW) and only inside a Picture World: it clears
//     that world's keys, star and bossWins entry (the world you came in through; in a shared world without one, every world of it), saves,
//     rebuilds the world's live parts and puts you at the world's arrival. Never shown without ?preview.
import { PICTURE_WORLDS } from './pictureworlds.js';
import { PREVIEW } from './comingsoon.js';

export const WORLD_RESETS = [
  { id: 'bubble', mark: 'pw:bubble:redesign1' }, // the Bubble Well's natural-rules redesign (2026-10-29); it was behind ?preview until then
];
// The Portal House grew to ten rooms with decoy pads (owner 2026-10-29: "reset my progress which I now had in the ?preview"); it is
// behind ?preview (comingsoon.js: not in OPEN_NOW), so only preview players had progress there.
WORLD_RESETS.push({ id: 'portal', mark: 'pw:portal:reset10' });
const MARKS = () => new Set(WORLD_RESETS.map(r => r.mark));

// Clears the progress of the Picture Worlds `ids` (keys in `beaten` and `keys`, stars, bossWins), never a reset mark. Pure on `game`.
export function clearWorlds(game, ids) {
  const marks = MARKS(), pre = ids.map(id => `pw:${id}:`), kp = ids.map(id => `${id}:`);
  const n0 = (game.beaten?.length ?? 0) + (game.stars?.length ?? 0);
  if (Array.isArray(game.beaten)) game.beaten = game.beaten.filter(k => typeof k !== 'string' || marks.has(k) || !pre.some(p => k.startsWith(p)));
  if (Array.isArray(game.keys)) game.keys = game.keys.filter(k => typeof k !== 'string' || !kp.some(p => k.startsWith(p)));
  if (Array.isArray(game.stars)) game.stars = game.stars.filter(s => !ids.includes(s));
  if (game.bossWins) for (const id of ids) delete game.bossWins[id];
  return n0 - (game.beaten?.length ?? 0) - (game.stars?.length ?? 0);
}

// After a save is loaded: every reset whose mark is missing runs once. fresh = a new game (only the marks are added). -> the ids reset
export function runWorldResets(game, { fresh = false } = {}) {
  game.beaten ??= [];
  const done = [];
  for (const r of WORLD_RESETS) {
    if (game.beaten.includes(r.mark)) continue;
    if (!fresh) { clearWorlds(game, [r.id]); done.push(r.id); }
    game.beaten.push(r.mark);
  }
  return done;
}

// The Picture Worlds of the place you are in: the one you came in through, else every world of that realm.
export function worldsHere(game) {
  const place = game.place, mine = PICTURE_WORLDS.filter(w => w.realm === place && w.ready);
  const via = game.realms?.via;
  if (mine.some(w => w.id === via)) return [via];
  return mine.map(w => w.id);
}

// The pause screen's button (only with ?preview). opts.save(): the game's save; opts.preview: tests may force it.
export function createWorldReset(game, { save, preview = PREVIEW } = {}) {
  const pauseEl = typeof document !== 'undefined' && document.getElementById('pause');
  const row = pauseEl?.querySelector('.pause-btns');
  const self = {
    preview,
    // shown while paused in a Picture World (?preview only)
    shows() { return !!self.preview && !!game.started && !!game.world?.realm?.parent && worldsHere(game).length > 0; },
    // clears this world's progress, saves, rebuilds its live parts and puts you at its arrival -> the ids cleared
    restart() {
      const ids = worldsHere(game);
      if (!ids.length || !game.world?.realm?.parent) return [];
      clearWorlds(game, ids);
      const w = game.world, p = game.player, at = w.arrivals?.[game.realms?.via] ?? w.arrivals?.[ids[0]] ?? w.arrivals?.[game.place];
      if (p) { p.carry = null; p.vel?.set(0, 0, 0); if (Array.isArray(at)) { p.pos.set(at[0], at[1], at[2]); p.yaw = at[3] ?? p.yaw; } else p.pos.copy(game.spawnPoint); }
      game.gymLive?.reset?.(w);
      save?.();
      game.ui?.renderHud?.();
      game.ui?.toast?.('Fresh start! This world is brand new again.');
      return ids;
    },
  };
  if (row) {
    const btn = document.createElement('button');
    btn.id = 'world-reset'; btn.className = 'hidden'; btn.textContent = '🔄 Start this world over';
    let armed = false;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!armed) { armed = true; btn.textContent = 'Tap again to start over'; return; }
      armed = false; btn.textContent = '🔄 Start this world over';
      self.restart();
    });
    row.append(' ', btn);
    const show = () => { btn.classList.toggle('hidden', !self.shows()); if (pauseEl.classList.contains('hidden')) { armed = false; btn.textContent = '🔄 Start this world over'; } };
    new MutationObserver(show).observe(pauseEl, { attributes: true, attributeFilter: ['class'] });
    self.button = btn; self.refresh = show;
  }
  return self;
}
