// The guide arrow and the "Welcome to the ..." / "closed" toasts. It knows nothing about kinds of gyms: it asks
// each gym's access object (src/access.js) where to point, what to say and whether it is open.
export function createGuide(game) {
  const acc = g => game.access.of(g);
  let tipGym = null, told = {}, currentGym = null;

  // Points the player towards the next gym they haven't beaten yet.
  function updateGuide() {
    const p = game.player.pos;
    const unbeaten = game.world.gyms.filter(g => !game.badges.includes(g.def.id));
    let next = unbeaten[0], note = '';
    // Gyms you have to wait for (night gyms by day) are skipped, and the arrow names them.
    if (next && acc(next).wait()) {
      const other = unbeaten.find(g => !acc(g).wait());
      if (other) {
        const groups = new Map(); // phrase -> names, in gym order
        for (const g of unbeaten.slice(0, unbeaten.indexOf(other))) {
          const w = acc(g).wait();
          groups.set(w, [...(groups.get(w) || []), acc(g).name]);
        }
        note = [...groups].map(([w, names]) => ` · ${names.join(' and ')} ${names.length > 1 ? 'open' : 'opens'} ${w}`).join('');
        next = other;
      } else note = ` (opens ${acc(next).wait()})`;
    }
    if (!next && !game.champion && game.world.tower) next = game.world.tower;
    if (!next) game.ui.setGuide('★ Champion! ★');
    else updateArrow(p, next, note);

    // Tips near a gym (today: the sky gyms' "build a tower" and pad tips), for the nearest unbeaten gym that has them.
    const dist = g => Math.hypot(g.x + 0.5 - p.x, g.z + 0.5 - p.z);
    const near = unbeaten.filter(g => acc(g).tips).sort((a, b) => dist(a) - dist(b))[0];
    if (near !== tipGym) { tipGym = near; told = {}; }
    if (tipGym) for (const msg of acc(tipGym).tips(p, told)) game.ui.toast(msg);

    const inside = [...game.world.gyms, game.world.tower].find(g => g && acc(g).contains(p)) || null;
    if (inside !== currentGym) {
      currentGym = inside;
      if (inside) game.ui.toast(acc(inside).closedText() || acc(inside).welcome());
    }
  }

  function updateArrow(p, next, note) {
    const aim = acc(next).aim(p);
    let arrow = '', dist = 0;
    if (aim.x === undefined) game.guideTarget = null;
    else {
      game.guideTarget = [aim.x, aim.z];
      const dx = aim.x - p.x, dz = aim.z - p.z;
      dist = Math.round(Math.hypot(dx, dz));
      // Angle of the target relative to where the player is looking.
      let rel = Math.atan2(-dx, -dz) - game.player.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const arrows = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'];
      arrow = arrows[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];
    }
    game.ui.setGuide(aim.text(arrow, dist) + acc(next).status() + note);
  }

  return { updateGuide };
}
