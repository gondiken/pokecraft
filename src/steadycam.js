// The steady camera (owner 2026-10-29, Cube Planets): over an edge the view does not roll to the new up; it dips to the sky colour
// for a moment and snaps while hidden (player.js turnView / dipAmount, GRAV.dipOut / dipIn). Off by default (the owner likes the
// eased turn). A per-device setting like Sound on/off (localStorage), never in the game save.
const KEY = 'pokecraft-steady';

function loadOn() {
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}

export const steadyCam = {
  on: loadOn(),
  setOn(on) {
    this.on = !!on;
    try { localStorage.setItem(KEY, this.on ? 'on' : 'off'); } catch { /* ignore */ }
  },
};
