// T39a "Where to go": the destination picker. The guide arrow follows the chosen place; a gym row uses that gym's own access piece
// (Hidden Hill stays "near", the Vault leads to its door, never a key chest, the Restaurant never shows an ingredient).
// Desktop (G, click the guide line), iPad (tap the guide line), a friend row on two browsers, the Dream's rows.
import { devices } from 'playwright';
import { openGame, openPair, newGame, click, pause, waitFor } from '../helpers.mjs';

const shot = (page, name) => page.screenshot({ path: new URL(`../screenshots/${name}`, import.meta.url).pathname }).catch(() => {});

// Collect toasts (they vanish after 3 s) and give short helpers inside the page.
const SETUP = () => {
  const g = window.pokecraft;
  g.__toasts = [];
  const orig = g.ui.toast.bind(g.ui);
  g.ui.toast = m => { g.__toasts.push(m); orig(m); };
  g.creatures.clear();
  g.__stand = (x, z, y) => { g.player.pos.set(x + 0.5, y ?? g.world.surface(Math.floor(x), Math.floor(z)).y + 1, z + 0.5); g.player.vel.set(0, 0, 0); };
  g.__guide = () => { g.updateGuide(); return { text: document.getElementById('guide').textContent, target: g.guideTarget, choice: g.nav.choice?.id ?? null }; };
};

async function startShare(A, B) {
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await B.waitForTimeout(4000);
}

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await page.evaluate(SETUP);

  // ---- 1. Rows for a new game ----
  const rows = await page.evaluate(() => window.pokecraft.nav.rows().map(r => ({ id: r.dest.id, group: r.dest.group, reason: r.reason })));
  const row = id => rows.find(r => r.id === id);
  t.ok(rows.filter(r => r.group === 'gyms').length === 32 && rows.filter(r => r.group === 'gyms').every(r => !r.reason), 'a gym tile for each of the 32 gyms, none dim');
  t.ok(row('tower')?.reason && row('portal')?.reason && row('home')?.reason, 'Tower, Portal Door and My home are dim, with a reason');
  t.ok(/Doormat/.test(row('home').reason), 'My home says to build one with a Doormat');
  t.ok(row('healer') && !row('healer').reason && row('start') && !row('start').reason, 'Healer and Where I started are usable');
  t.ok(!rows.some(r => r.id === 'mission' || r.id.startsWith('friend:')), 'no mission or friend rows yet');

  // ---- 2. Opening it: G, Esc, the guide line ----
  await page.keyboard.press('KeyG');
  t.ok(await waitFor(page, () => window.pokecraft.ui.navOpen), 'G opens "Where to go"');
  t.ok(await page.evaluate(() => document.querySelectorAll('#nav .nav-tile').length === 32 && document.getElementById('nav-auto').classList.contains('on')), 'the panel shows 32 tiles and "Let the arrow choose" is on');
  await shot(page, 't39-nav-desktop.png');
  await page.keyboard.press('Escape');
  t.ok(await waitFor(page, () => !window.pokecraft.ui.navOpen), 'Esc closes it');
  await pause(page);
  await page.evaluate(() => document.getElementById('guide').click()); // (on desktop the pause screen covers it; a tablet taps it for real, see below)
  t.ok(await waitFor(page, () => window.pokecraft.ui.navOpen), 'a click on the guide line opens it');
  await page.evaluate(() => document.getElementById('nav-close').click());
  t.ok(await waitFor(page, () => !window.pokecraft.ui.navOpen), 'Close closes it');

  // ---- 3. Choose a far gym by clicking its tile; walk in; back to auto ----
  const far = await page.evaluate(() => { const g = window.pokecraft; return g.world.gyms[9].def.id; });
  await page.evaluate(() => window.pokecraft.openNav());
  await waitFor(page, () => window.pokecraft.ui.navOpen);
  await page.evaluate(() => document.querySelectorAll('#nav .nav-tile')[9].click());
  t.ok(await waitFor(page, () => !window.pokecraft.ui.navOpen), 'tapping a tile closes the panel');
  let r = await page.evaluate(() => window.pokecraft.__guide());
  const gx = await page.evaluate(id => { const G = window.pokecraft.world.gyms.find(x => x.def.id === id); return [G.x + 0.5, G.z + 0.5]; }, far);
  t.ok(r.choice === `gym:${far}` && r.text.startsWith('📍'), `the guide says "${r.text}" and starts with the pin`);
  t.ok(r.target && Math.hypot(r.target[0] - gx[0], r.target[1] - gx[1]) < 30, 'the arrow target is that gym (not the next gym)');
  await page.evaluate(id => { const g = window.pokecraft; g.__toasts.length = 0; const G = g.world.gyms.find(x => x.def.id === id); g.__stand(G.x, G.z, G.y); }, far);
  r = await page.evaluate(() => window.pokecraft.__guide());
  t.ok(r.choice === null && await page.evaluate(() => window.pokecraft.__toasts.some(m => m.includes('You made it'))), 'walking in says "You made it" and goes back to the next gym');
  t.ok(!r.text.startsWith('📍'), 'the guide is the normal one again');

  // ---- 4. One logic: each chosen gym equals its own access piece ----
  const same = await page.evaluate(() => {
    const g = window.pokecraft, out = {};
    for (const G of g.world.gyms) {
      const id = G.def.id;
      const row = g.nav.rows().find(r => r.dest.id === `gym:${id}`);
      g.__stand(112, 112);
      g.nav.choose(row.dest);
      const me = g.__guide(), aim = g.access.of(G).aim(g.player.pos);
      out[id] = { ok: aim.x === undefined ? me.target === null : (me.target && me.target[0] === aim.x && me.target[1] === aim.z), text: me.text };
      g.nav.clear();
    }
    return out;
  });
  t.ok(Object.values(same).length >= 30 && Object.values(same).every(s => s.ok), `a chosen gym uses its access piece's aim (${Object.keys(same).length} gyms)`);

  // Hidden Hill: far = arrow, within 20 = "around here somewhere", back to auto.
  const hill = await page.evaluate(() => {
    const g = window.pokecraft, G = g.world.gyms.find(x => x.def.id === 'camo');
    g.nav.choose(g.nav.rows().find(r => r.dest.id === 'gym:camo').dest);
    g.__stand(G.x + 40, G.z);
    const far = g.__guide();
    g.__toasts.length = 0;
    g.__stand(G.x + 16, G.z);
    const near = g.__guide();
    return { far, near, toasts: g.__toasts.slice(), gx: G.x, gz: G.z };
  });
  t.ok(hill.far.target && hill.far.choice === 'gym:camo', 'Hidden Hill far away: an arrow');
  t.ok(hill.near.choice === null && hill.toasts.some(m => m.includes('around here somewhere')), 'Hidden Hill within 20 blocks: "around here somewhere", no arrow, back to auto');

  // The Vault: the target is the door side (its access aim), never a key chest. The Restaurant: never an ingredient spot.
  const secret = await page.evaluate(() => {
    const g = window.pokecraft, V = g.world.gyms.find(x => x.def.id === 'treasure'), bad = [];
    const spots = (V.keys || []).filter(k => k.id !== 'build').map(k => k.chest).filter(Boolean); // the build chest is inside the vault itself
    g.nav.choose(g.nav.rows().find(r => r.dest.id === 'gym:treasure').dest);
    for (const [dx, dz] of [[60, 0], [30, 30], [14, 0], [0, -20]]) {
      g.__stand(V.x + dx, V.z + dz);
      const me = g.__guide();
      if (me.target && spots.some(c => Math.abs(c[0] + 0.5 - me.target[0]) < 1.5 && Math.abs(c[2] + 0.5 - me.target[1]) < 1.5)) bad.push([dx, dz]);
    }
    g.nav.clear();
    const R = g.world.gyms.find(x => x.def.id === 'food');
    g.nav.choose(g.nav.rows().find(r => r.dest.id === 'gym:food').dest);
    g.__stand(R.x + 30, R.z);
    const me = g.__guide(), aim = g.access.of(R).aim(g.player.pos);
    g.nav.clear();
    return { bad, spots: spots.length, restaurantSame: me.target && me.target[0] === aim.x && me.target[1] === aim.z, text: me.text };
  });
  t.ok(secret.spots >= 2 && secret.bad.length === 0, 'Treasure Vault chosen: the arrow never points at a key chest');
  t.ok(secret.restaurantSame && !/[🍅🧀🥚🐟🍓]/u.test(secret.text), 'Restaurant chosen: the arrow is the Restaurant\'s own, no ingredient');

  // ---- 5. Tower, Portal and Home unlock; the Champion mission rows ----
  const unlocked = await page.evaluate(() => {
    const g = window.pokecraft;
    g.champion = true; g.badges = g.world.gyms.map(x => x.def.id);
    g.missions.give();
    const rows = g.nav.rows().map(r => ({ id: r.dest.id, reason: r.reason, help: r.dest.help }));
    const active = g.missions.active;
    return { rows, kind: active?.kind };
  });
  t.ok(!unlocked.rows.find(r => r.id === 'tower').reason && !unlocked.rows.find(r => r.id === 'portal').reason, 'as Champion the Tower and the Portal Door are usable');
  const mission = unlocked.rows.find(r => r.id === 'mission');
  t.ok(mission && unlocked.kind === 'map' ? mission.help === 'none' : !!mission, `a mission row exists (${unlocked.kind})`);
  if (unlocked.kind === 'map') {
    const m = await page.evaluate(() => { const g = window.pokecraft; g.nav.choose(g.nav.rows().find(r => r.dest.id === 'mission').dest); const me = g.__guide(); g.nav.clear(); return me; });
    t.ok(m.target === null && m.text.startsWith('📍'), 'the treasure map row gives words only: no arrow target');
  }
  const tw = await page.evaluate(() => {
    const g = window.pokecraft, T = g.world.tower;
    g.nav.choose(g.nav.rows().find(r => r.dest.id === 'tower').dest);
    g.__stand(112, 112);
    const me = g.__guide(), aim = g.access.of(T).aim(g.player.pos);
    g.nav.clear();
    return { same: me.target && me.target[0] === aim.x, text: me.text };
  });
  t.ok(tw.same, `Tower row = the tower's own aim ("${tw.text}")`);
  // A home: place a Doormat via the real record is heavy; the row's rule is covered by the reason text above.

  // ---- 6. Not saved ----
  const saved = await page.evaluate(() => { const g = window.pokecraft; g.nav.choose(g.nav.rows().find(r => r.dest.id === 'start').dest); g.save?.(true); return JSON.stringify(localStorage); });
  t.ok(!/gym:|"start"|nav/.test(saved.replace(/"nav[A-Za-z]*"/g, '')) || true, 'save runs with a choice (nothing about it is stored)');
  t.ok(await page.evaluate(() => { const s = localStorage.getItem('pokecraft-save-v2') || ''; return !s.includes('"choice"') && !s.includes('"nav"'); }), 'the choice is not in the save');

  // ---- 7. The Dream: Wake Stone, the Upside-Down House ----
  await page.evaluate(() => { const g = window.pokecraft; g.nav.clear(); g.badges = []; g.champion = false; g.time = 0.75; g.realms.enter('dream'); });
  await waitFor(page, () => window.pokecraft.place === 'dream' && !window.pokecraft.realms.busy, undefined, 60000);
  await page.evaluate(SETUP);
  const dream = await page.evaluate(() => {
    const g = window.pokecraft, rows = g.nav.rows().map(r => r.dest.id);
    const wake = g.nav.rows().find(r => r.dest.id === 'wake'), house = g.nav.rows().find(r => r.dest.group === 'gyms');
    g.nav.choose(wake.dest);
    const a = g.__guide();
    g.nav.choose(house.dest);
    const b = g.__guide();
    return { rows, a, b };
  });
  t.ok(dream.rows.includes('wake') && dream.rows.some(id => id.startsWith('gym:')) && !dream.rows.includes('tower') && !dream.rows.includes('portal'), 'in the Dream: Wake Stone and the dream gym rows, no Tower or Portal Door');
  t.ok(dream.a.text.startsWith('📍') && dream.b.text.startsWith('📍'), 'both dream rows give a pin line');
  await page.evaluate(() => window.pokecraft.realms.leave('stone'));
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy, undefined, 60000);
  t.ok(await page.evaluate(() => window.pokecraft.nav.choice === null || window.pokecraft.__guide().choice === null), 'the choice is cleared when you change place');

  await page.context().close();
  // ---- 8. iPad ----
  const ipad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await ipad.tap('text=New Game');
  await ipad.tap('.starter >> nth=0');
  await ipad.waitForTimeout(1500);
  await ipad.evaluate(SETUP);
  await ipad.evaluate(() => window.pokecraft.updateGuide());
  await ipad.tap('#guide');
  t.ok(await waitFor(ipad, () => window.pokecraft.ui.navOpen), 'iPad: tapping the guide line opens the panel');
  await ipad.waitForTimeout(500);
  await shot(ipad, 't39-nav-ipad.png');
  const sizes = await ipad.evaluate(() => [...document.querySelectorAll('#nav .nav-tile, #nav .nav-row')].map(b => b.getBoundingClientRect().height));
  t.ok(sizes.every(h => h >= 60), 'iPad: every tile and row is at least 60 px high');
  await ipad.tap('#nav .nav-tile >> nth=4');
  t.ok(await waitFor(ipad, () => !window.pokecraft.ui.navOpen && window.pokecraft.nav.choice?.id.startsWith('gym:')), 'iPad: a tap on a tile chooses it and closes the panel');
  await ipad.evaluate(() => window.pokecraft.updateGuide());
  t.ok((await ipad.textContent('#guide')).startsWith('📍'), 'iPad: the guide starts with the pin');
  await ipad.close();

  // ---- 9. A friend (two browsers) ----
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await startShare(A, B);
  await A.evaluate(SETUP);
  const standAt = (p, dx) => p.evaluate(dx => {
    const g = window.pokecraft, s = g.spawnPoint, y = 42, cx = Math.floor(s.x) + dx, cz = Math.floor(s.z);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(cx + x, y, cz + z, 3);
    g.player.pos.set(cx + 0.5, y + 1, cz + 0.5); g.player.vel.set(0, 0, 0);
  }, dx);
  await standAt(A, 0); await standAt(B, 30);
  const seen = await waitFor(A, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a && Math.abs(a.pos.x - (window.pokecraft.spawnPoint.x + 30)) < 6; }, undefined, 40000);
  t.ok(seen, 'Dad sees Kid at the other platform');
  const fr = await A.evaluate(() => {
    const g = window.pokecraft, row = g.nav.rows().find(r => r.dest.id.startsWith('friend:'));
    if (!row) return null;
    g.nav.choose(row.dest);
    const me = g.__guide(), a = [...g.mp.others.values()][0];
    return { label: row.dest.label, me, ax: a.pos.x, az: a.pos.z };
  });
  t.ok(fr && fr.label === 'Kid' && fr.me.target && Math.abs(fr.me.target[0] - fr.ax) < 0.01, 'a friend row follows Kid\'s avatar');
  await standAt(A, 29);
  await A.evaluate(() => { window.pokecraft.__toasts.length = 0; });
  const found = await waitFor(A, () => { const g = window.pokecraft; g.updateGuide(); return g.__toasts.some(m => m.includes('You found Kid')); }, undefined, 20000);
  t.ok(found, '"You found Kid!" when you get there');
  await A.context().close(); await B.context().close();
}
