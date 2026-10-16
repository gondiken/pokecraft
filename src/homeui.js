// T22: the home UI (game.homeUi): meter in the HUD, red glow + floor outline in the world, the home panel
// (chooser / home / preview) and the spinning example model. STEP 0 SKELETON: builder B fills it in (plans/T22.md
// section 6). Everything here reads game.homes (active home, result, report) and HOME_TYPES; no type ids.
//
// Contract used by the rest of the game (keep these names):
//   homeUi.open(view)   view = 'choose' | 'home' | 'preview' (default 'home'); called by ui.openPanel('home') AFTER #home is shown
//   homeUi.close()      called by ui.closePanel() (always, whatever is open); stop rendering the preview here
//   homeUi.update(now)  every frame from main.js frame() (now = ms); meter / glow / pulse / preview render
//   homeUi.state()      for tests: { view, yaw, pitch, zoom, blinkOn, missing: [...] }
//   homeUi.want         view that game.openHome(view) asked for before the panel opened (read it in open(), default 'home')
// DOM: #home-meter (in #hud, hidden by default), #home (overlay, .panel inside), #home-body (render into it), #home-close.
export function createHomeUi(game, { atlas, texture }) {
  const state = { view: null, yaw: 0, pitch: 0, zoom: 1, blinkOn: true, missing: [] };
  const body = document.getElementById('home-body');
  const ui = {
    atlas, texture,
    want: null,
    open(view = 'home') {
      state.view = view;
      if (body) body.replaceChildren(document.createTextNode(view === 'choose' ? 'What kind of home?' : 'Your home'));
    },
    close() { state.view = null; },
    update(now) { /* builder B */ },
    state() { return { ...state, missing: [...state.missing] }; },
  };
  return ui;
}
