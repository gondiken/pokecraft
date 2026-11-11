// Chapter 3's world, Wobbleland (plans/chapter3-world.md, ?preview only):
//   land:   the terrain in Node (tests/wobblecheck.mjs): every patch reachable from Inkpot Camp, rings walkable, the wall closes the rest
//   door:   the Paper Door on the Wizard's island: none without being his Ally, none without ?preview; the Ally steps in (the game's own use),
//           arrives at the Camp, reloads inside, walks back up through the way back with real keys, and a following guest is let in
//   look:   the curl (one switch), the first-draft colours, grey where the Scribble is and the colour flood; the main world draws the same
//           frame byte for byte before and after a trip (the WOBBLE define only exists in Wobbleland); draw calls and frame time
//   patches: the fight on every patch from data (tests/wobblebots.mjs: mashing with a type-neutral team under a quarter, skilled all, person
//           times), W walks you into the nearest patch, a win saves its key, +3 cubes, floods its colour, the next patch comes, a reload keeps it
//   loop:   the meter chip, a "Where to go" row per open patch (the knot only once the others are clear), the arrow, the Wizard and the
//           healer at the Camp, freed creatures in the spawn table once their patch is cleared, the Wizard's words on a win
//   ipad:   an emulated iPad in Wobbleland: the look, the meter, the touch buttons, walking with the joystick into patch 1
//   knot:   the Grumble (bigger, tougher, turns slowly; a hit counts fully only on its back or right after it struck; mashing from the
//           front loses: part `patches` patch 6), the knot's win floods the whole meadow, the wall melts, a reload keeps it
//   ride:   B (owner 2026-11-11): R and riding / flying in Wobbleland, hopping off into a patch's fight, the wall fences riders
//   hops:   A3 paint-pot hops (the Camp's pot, a pot per cleared patch, look and E, the iPad's button)
//   bugs:   A2 scribble bugs (tests/wobblebugbots.mjs at 60 / 20 fps; real keys and the iPad's joystick corner one; a cleared patch's go)
//   springs: C4 / C5 a floating hill with a chest: walking and jumping never get you up, the spring beside it does (real keys)
//   river:  the floating river carries you up to its hill with no keys; freed creatures near their patch and on floating hills
//   ice:    Slippy Lake in Node (tests/wobblenode.mjs, the real Player and ScribbleFight): a walk glides about 2 blocks on the ice (60 = 20
//           fps), an Ice ride keeps its grip, the meadow stops at once; the chutes and leads carry you to the island with no keys; in a
//           fight a creature that slides glides on and an Ice one stops dead; a slipping monster's red line is longer
//   lake:   Slippy Lake in a browser, real keys: open from the start (no walls), the meter / arrow / rows for the lake, its far patches drawn,
//           W on the ice and let go = a glide with skid marks, a chute ride with no keys, walking into a lake patch starts its fight on the
//           ice, a win (key, cubes, the Wizard's words), a reload, freed creatures by their patch and on the islands, the lake's knot
//           (Blizzbear, an Ice Grumble), the whole lake in colour; screenshots
//   lakeipad: the same lake on an emulated iPad: the joystick on the ice glides, the chip, the touch buttons
//   lakebots: tests/wobblebots.mjs runLake: every lake patch with the Ice, the neutral and the owner's team (mashing under a quarter with
//           the Ice and neutral teams, skilled wins with all three; how much the Ice type helps is reported)
//   WOBBLE_ONLY=land|ride|hops|bugs|springs|river|door|look|patches|loop|ipad|knot|ice|lake|lakeipad|lakebots      screenshots: tests/screenshots/wobble-*.png
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, newGame, waitFor } from '../helpers.mjs';

const only = process.env.WOBBLE_ONLY;
const want = name => !only || only.split(',').includes(name);
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const frames = (page, n = 3) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// A Champion (and, with ally, the Wizard's Ally) in the Swirl.
export async function intoSwirl(page, { ally = true } = {}) {
  await page.evaluate(ally => { const g = window.pokecraft; g.champion = true; if (ally) { g.studio.won = true; g.studio.ally = true; } g.realms.enter('swirl', { back: g.world.portal.stand }); }, ally);
  await placeIs(page, 'swirl');
  await frames(page, 4);
}
// Through the Paper Door (the game's own use of the block), into Wobbleland.
export async function intoWobble(page) {
  await intoSwirl(page);
  await waitFor(page, () => window.pokecraft.portal.info?.()?.paper, null, 30000).catch(() => {});
  await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
  await placeIs(page, 'wobble');
}

export default async function ({ browser, base, t }) {
  if (want('land')) {
    const { checkWobble } = await import('../wobblecheck.mjs');
    const r = await checkWobble();
    t.ok(!r.problems.length, `Wobbleland: every patch reachable from the Camp, rings walkable (${r.out.rings.map(q => `${q.id}: ${q.walk} %${q.wet ? ` ${q.wet} wet` : ''}`).join(', ')}), no overlap, the wall closes Bumpy Hills (${r.out.hills} cells behind it) ${r.problems.slice(0, 4).join('; ')}`);
  }

  if (want('ice')) {
    const { checkIce } = await import('../wobblenode.mjs');
    const r = await checkIce();
    const o = r.out;
    t.ok(!r.problems.length, `Slippy Lake with the real Player and fight: a walk glides ${o.glide60} (60 fps) / ${o.glide20} (20 fps), a sprint ${o.sprint}, an Ice ride ${o.iceRide}, a Fire ride ${o.fireRide}, the meadow ${o.meadow}; chutes to the island in ${o.chutes.map(c => `${c.island} s`).join(', ')} (top speed ${o.chutes[0].top}); in a fight a Fire creature glides ${o.fight.fire}, an Ice one ${o.fight.ice}, in the meadow ${o.fight.meadow}; a slipping monster's red line ${o.lines.slips} vs ${o.lines.grips} ${r.problems.join('; ')}`);
  }

  if (want('lake') || want('lakeipad')) for (const dev of [want('lake') && null, want('lakeipad') && 'iPad (gen 7) landscape'].filter(x => x !== false)) {
    const page = await openGame(browser, base, { query: '?preview', ...(dev ? { contextOptions: devices[dev] } : {}) });
    await newGame(page, 0);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('blazehound', 30), S.makeCreature('tidalord', 30), S.makeCreature('thunderwolf', 30)]; });
    await intoWobble(page);
    const tag = dev ? 'iPad: ' : '';
    // every region is open from the start (owner 2026-11-11): the lake's tangles are in "Where to go" before any meadow patch is won,
    // and nothing stands between the meadow and the lake
    const open0 = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); let wall = 0; for (let y = L.BASE + 2; y < 30; y++) for (const x of [60, 61]) if (g.world.get(x, y, 180) !== 0) wall++; return { rows: g.nav.rows().filter(x => x.dest.id.startsWith('wobble:')).map(x => x.dest.id), wall }; });
    t.ok(open0.rows.includes('wobble:7') && open0.rows.includes('wobble:1') && !open0.rows.includes('wobble:11') && !open0.wall, `${tag}Slippy Lake is open from the start: its patches are listed with the meadow's, no wall between them (${JSON.stringify(open0)})`);
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); for (const id of [1, 2, 3, 4, 5, 6]) g.beaten.push(L.patchKey(id)); });
    // on the lake's shore: the meter is the lake's, the arrow and the rows lead to its patches, the far ones are drawn
    await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(58.5, 11, 100.5); g.player.vel.set(0, 0, 0); g.player.yaw = Math.PI / 2; g.player.pitch = -0.12; });
    await frames(page, 6);
    await waitFor(page, () => /Slippy Lake/.test(document.getElementById('score-chip')?.textContent || '') && /Tangle/.test(document.querySelector('#guide')?.textContent || ''), null, 30000).catch(() => {});
    await waitFor(page, () => window.pokecraft.scribble.farInfo().length === 5 && window.pokecraft.scribble.info().patch >= 7, null, 60000).catch(() => {});
    const loop = await page.evaluate(() => ({ chip: document.getElementById('score-chip')?.textContent, guide: document.querySelector('#guide')?.textContent, rows: window.pokecraft.nav.rows().filter(x => x.dest.id.startsWith('wobble:')).map(x => x.dest.id).join(), live: window.pokecraft.scribble.info().patch, far: window.pokecraft.scribble.farInfo().join() }));
    t.ok(/Slippy Lake 0 \/ 7/.test(loop.chip) && /Tangle/.test(loop.guide) && loop.rows === 'wobble:7,wobble:8,wobble:9,wobble:10,wobble:12,wobble:13' && loop.far.split(',').length === 5, `${tag}on the shore: the chip is the lake's, the arrow points at a lake patch, "Where to go" lists its six tangles (the knot last), the five not live are drawn from afar (${JSON.stringify(loop)})`);
    if (!dev) await shot(page, 'wobble-lake.png');
    // walk onto the ice and let go: you glide on, leaving skid marks
    const glide = async () => {
      if (!dev) { await page.keyboard.down('w'); await waitFor(page, () => window.pokecraft.player.pos.x < 44, null, 30000).catch(() => {}); await page.keyboard.up('w'); }
      else {
        const vp = page.viewportSize(), cdp = await page.context().newCDPSession(page), x0 = 140, y0 = vp.height - 160;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
        for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - k * 12, id: 1 }] });
        await waitFor(page, () => window.pokecraft.player.pos.x < 44, null, 60000).catch(() => {});
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      const x0 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, ice: window.pokecraft.world.groundAt(window.pokecraft.player.pos)?.id ?? null }));
      await waitFor(page, () => window.pokecraft.gymLive.of('part:wobble').info().skids > 0, null, 15000).catch(() => {});
      x0.skid = await page.evaluate(() => window.pokecraft.gymLive.of('part:wobble').info().skids);
      await waitFor(page, () => Math.hypot(window.pokecraft.player.vel.x, window.pokecraft.player.vel.z) < 0.05, null, 30000).catch(() => {});
      return page.evaluate(x0 => { const p = window.pokecraft.player; return { glide: +(x0.x - p.pos.x).toFixed(2), skids: Math.max(x0.skid, window.pokecraft.gymLive.of('part:wobble').info().skids), ice: x0.ice }; }, x0); // (on ice when you let go; you may glide onto a snow drift)
    };
    const g1 = await glide();
    t.ok(g1.ice === 'ice' && g1.glide > 2 && g1.glide < 7 && g1.skids > 0, `${tag}${dev ? 'the joystick' : 'W'} on the ice, then let go: you glide on ${g1.glide} blocks and leave skid marks (${JSON.stringify(g1)})`);
    if (!dev) { await page.evaluate(() => { window.pokecraft.player.yaw = -Math.PI / 2; window.pokecraft.player.pitch = -0.75; }); await frames(page, 2); await shot(page, 'wobble-lake-skid.png'); } // (looking back down at the marks)
    if (!dev) { // a chute with no keys: down the hill, into the lead, carried to the island
      const top = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), c = L.CHUTES[1]; g.player.pos.set(c.x0 + 1, L.chuteFloor(c, c.z0) + 1, c.z0 + 0.5 + c.dir * 0.6); g.player.vel.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = -0.3; return { i: L.LAKE.isles[0], y: L.LAKE.y }; });
      await waitFor(page, () => window.pokecraft.player.pos.z < 212, null, 30000).catch(() => {});
      await shot(page, 'wobble-lake-chute.png');
      await waitFor(page, ([x, z, r, y]) => { const p = window.pokecraft.player; return Math.hypot(p.pos.x - x, p.pos.z - z) < r && p.onGround && p.pos.y >= y + 1.9; }, [top.i.x + 0.5, top.i.z + 0.5, top.i.r, top.y], 90000).catch(() => {});
      const at = await page.evaluate(() => { const p = window.pokecraft.player; return [p.pos.x, p.pos.y, p.pos.z].map(v => +v.toFixed(1)); });
      t.ok(Math.hypot(at[0] - top.i.x - 0.5, at[2] - top.i.z - 0.5) < top.i.r && at[1] >= top.y + 1.9, `no keys: the ice chute shoots you down the hill, the lead's current carries you to the east island (${at})`);
    }
    // walk into a lake patch (W, real keys / the joystick): its fight starts on the ice
    await page.evaluate(() => { const g = window.pokecraft, q = g.world.wobble.patches.find(r => r.id === 7); g.player.pos.set(q.x + 0.5, q.y, q.z + 9.5); g.player.vel.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = -0.1; });
    await waitFor(page, () => window.pokecraft.scribble.info().patch === 7, null, 30000).catch(() => {});
    if (!dev) await page.keyboard.down('w');
    else { const vp = page.viewportSize(), cdp = await page.context().newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: vp.height - 160, id: 1 }] }); for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: vp.height - 160 - k * 10, id: 1 }] }); page.__cdp = cdp; }
    await waitFor(page, () => ['enter', 'fight'].includes(window.pokecraft.scribble.info().phase), null, 90000).catch(() => {});
    if (!dev) await page.keyboard.up('w'); else await page.__cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 60000).catch(() => {});
    // the creature slides about: walk it a moment and let go (the fight's own input), so the shot shows skid marks
    if (!dev) { await page.keyboard.down('d'); await frames(page, 6); await page.keyboard.up('d'); await frames(page, 2); }
    await shot(page, dev ? 'wobble-lake-ipad-fight.png' : 'wobble-lake-fight.png');
    await page.evaluate(async () => { window.__GR = await import('/src/groundrules.js'); });
    const fi = await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(), G = F.g; return { foes: F.foes.map(f => f.c.species), ice: G.rule(F.you.x, F.you.z, F.you.y)?.id, grips: F.foes.map(f => window.__GR.GROUND.ice.grips(f.type)) }; }); // (by type: a monster on a snow drift grips anyway)
    t.ok(fi.foes.join() === 'frostling,shellby,zipskate' && fi.ice === 'ice' && fi.grips.join() === 'true,false,false', `${tag}walking into lake patch 7 starts its fight on the ice: Frostling keeps its grip, Shellby and Zipskate slide (only Zipskate charges, so only it skates at you) (${JSON.stringify(fi)})`);
    const cubes0 = await page.evaluate(() => window.pokecraft.cubes);
    await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); for (const x of F.foes) F.hit(F.you, x, 99999, 'normal'); });
    await waitFor(page, () => window.pokecraft.beaten.includes('pw:wobble:patch7'), null, 60000).catch(() => {});
    await waitFor(page, () => !window.pokecraft.scribble.fighting, null, 60000).catch(() => {});
    const won = await page.evaluate(() => ({ key: window.pokecraft.beaten.includes('pw:wobble:patch7'), cubes: window.pokecraft.cubes, toasts: [...document.querySelectorAll('#toasts > *, .toast')].map(e => e.textContent).join(' | ') }));
    t.ok(won.key && won.cubes === cubes0 + 3, `${tag}a win clears lake patch 7 (saved) and gives 3 Capture Cubes (${JSON.stringify(won)})`);
    if (dev) { t.ok(!page.errors.length, `no page errors on the iPad (${page.errors.join(' | ')})`); await page.context().close(); continue; }
    // freed creatures: by their own lake patch and on the islands
    const sp = await page.evaluate(async () => {
      const g = window.pokecraft, L = await import('/src/wobbleland.js'), q = L.patchOf(7), out = { patch: [], isle: [] };
      for (let i = 0; i < 40; i++) { const a = L.wobbleSpot(g.world, 'patch7', { x: q.x, z: q.z }); if (a) out.patch.push(Math.round(Math.hypot(a.x - q.x, a.z - q.z))); const f = L.wobbleSpot(g.world, 'isle', { x: 40, z: 180 }); if (f) out.isle.push(L.LAKE.isles.some(i => Math.hypot(f.x - i.x, f.z - i.z) < i.r + 1)); }
      out.table = g.creatures.table('wobbleLake').filter(e => g.creatures.context?.().after?.(e[3]) ?? true).map(e => e[0]);
      return out;
    });
    t.ok(sp.patch.length > 30 && sp.patch.every(d => d >= 3 && d <= 12) && sp.isle.length > 5 && sp.isle.every(Boolean) && ['frostling', 'shellby', 'zipskate'].every(x => sp.table.includes(x)) && !sp.table.includes('waddlice'), `freed lake creatures: round their own patch and on the islands, only patch 7's so far (${sp.patch.length} / ${sp.isle.length}; ${[...new Set(sp.table)].join(', ')})`);
    // a reload: patch 7 stays clear
    await page.evaluate(() => window.pokecraft.save?.(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await page.evaluate(() => [...document.querySelectorAll('#title-buttons button')].find(b => /Continue/.test(b.textContent))?.click());
    await placeIs(page, 'wobble');
    await frames(page, 8);
    const re = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); return { rows: g.nav.rows().filter(x => x.dest.id.startsWith('wobble:')).map(x => x.dest.id).join() }; });
    t.ok(re.rows === 'wobble:8,wobble:9,wobble:10,wobble:12,wobble:13', `after a reload lake patch 7 stays clear (${JSON.stringify(re)})`);
    // the lake's knot: Blizzbear, an Ice Grumble; clearing it colours the whole lake
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); for (const id of [8, 9, 10, 12, 13]) g.beaten.push(L.patchKey(id)); const q = L.patchOf(11); g.player.pos.set(q.x + 0.5, L.LAKE.y + 1, q.z + 9.5); g.player.vel.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = -0.1; });
    await waitFor(page, () => window.pokecraft.scribble.info().patch === 11, null, 30000).catch(() => {});
    await page.keyboard.down('w');
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 90000).catch(() => {});
    await page.keyboard.up('w');
    await frames(page, 6);
    await shot(page, 'wobble-lake-knot.png');
    await page.evaluate(async () => { window.__GR = await import('/src/groundrules.js'); });
    const kn = await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); return F && { foes: F.foes.map(f => f.c.species + (f.grumble ? '*' : '')), grips: F.foes.filter(f => f.grumble).map(f => window.__GR.GROUND.ice.grips(f.type)) }; });
    t.ok(kn?.foes.includes('blizzbear*') && kn.foes.length === 4 && kn.grips[0] === true, `the lake's knot: three monsters and Blizzbear, an Ice Grumble that keeps its grip (${JSON.stringify(kn)})`);
    await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); for (const x of F.foes) { x.openT = 1; F.hit(F.you, x, 99999, 'normal'); } });
    await waitFor(page, () => window.pokecraft.beaten.includes('pw:wobble:patch11') && !window.pokecraft.scribble.fighting, null, 90000).catch(() => {});
    await waitFor(page, () => !window.pokecraft.wobbleLook.info().floods, null, 30000).catch(() => {});
    const done = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), w = g.world; return { lake: g.wobbleLook.colourAt(20, 160), north: g.wobbleLook.colourAt(20, 90), rows: g.nav.rows().filter(x => x.dest.id.startsWith('wobble:')).length, chip: document.getElementById('score-chip')?.textContent }; });
    t.ok(done.lake === 1 && done.north === 1 && !done.rows && /Slippy Lake 7 \/ 7/.test(done.chip), `the lake's knot cleared: the whole lake in colour, nothing left to fight (${JSON.stringify(done)})`);
    await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(30.5, 26, 222.5); g.player.vel.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = -0.35; g.player.flyHold = true; });
    await frames(page, 3);
    await shot(page, 'wobble-lake-bright.png');
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('lakebots')) {
    const { wobblePage, runLake } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    const r = await runLake(page, { games: 2, log: () => {} });
    for (const l of r.lines) t.ok(l.startsWith('ok'), l.replace(/^(ok {2}|FAIL) /, ''));
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('ride')) {
    // B (owner 2026-11-11: "why can't I ride or fly my creature here?"): riding and flying everywhere in Wobbleland, real keys
    const { wobblePage } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'), mk = id => { const c = S.makeCreature(id, 30); c.traits = ['rideable']; return c; }; g.party = [mk('blazehound'), mk('kitegale'), mk('tidalord')]; g.player.pos.set(112.5, 11, 200.5); g.player.yaw = 0; g.player.pitch = 0; });
    await frames(page, 4);
    await page.keyboard.press('r');
    await frames(page, 3);
    const on = await page.evaluate(() => ({ on: window.pokecraft.riding.on, kind: window.pokecraft.riding.kind, why: window.pokecraft.touchWhy.ride }));
    t.ok(on.on && on.kind === 'land' && !on.why, `R gets you on your creature in Wobbleland (${JSON.stringify(on)})`);
    // ride north (W) into patch 1: you hop off and the fight starts
    await page.keyboard.down('w');
    await waitFor(page, () => ['enter', 'fight'].includes(window.pokecraft.scribble.info().phase), null, 60000).catch(() => {});
    await page.keyboard.up('w');
    const f = await page.evaluate(() => ({ phase: window.pokecraft.scribble.info().phase, riding: window.pokecraft.riding.on }));
    t.ok(['enter', 'fight'].includes(f.phase) && !f.riding, `riding into a patch: you hop off and the fight starts on foot (${JSON.stringify(f)})`);
    await page.keyboard.press('r');
    await frames(page, 2);
    t.ok(!(await page.evaluate(() => window.pokecraft.riding.on)), 'R does nothing in a scribble fight');
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 60000).catch(() => {});
    await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); for (const x of F.foes) F.hit(F.you, x, 9999, 'normal'); });
    await waitFor(page, () => !window.pokecraft.scribble.fighting, null, 90000).catch(() => {});
    // fly: Kitegale, Space up, W west: no wall any more (owner 2026-11-11: every region walkable), you fly on over Slippy Lake
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); g.player.pos.set(80.5, L.heightAt(80, 192) + 1, 192.5); g.player.yaw = Math.PI / 2; g.player.pitch = 0; g.riding.start(g.party[1]); });
    await page.keyboard.down('Space'); await page.waitForTimeout(1500); // (hold Space to stay up)
    await page.keyboard.down('w');
    await waitFor(page, () => window.pokecraft.player.pos.x < 58, null, 90000).catch(() => {});
    const sky = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); return { kind: g.riding.kind, x: g.player.pos.x, up: g.player.pos.y - (L.heightAt(Math.floor(g.player.pos.x), Math.floor(g.player.pos.z)) + 1) }; });
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    t.ok(sky.kind === 'sky' && sky.up > 2 && sky.x < 58, `flying: up over the meadow and on west over Slippy Lake, nothing walls it off (${JSON.stringify(sky)})`);
    await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(76.5, g.player.pos.y + 4, 214.5); g.player.yaw = -Math.PI / 4; g.player.pitch = -0.05; });
    await frames(page, 6);
    await shot(page, 'wobble-fly.png');
    // fly low over patch 2: you land in it and the fight starts
    await page.evaluate(() => { const g = window.pokecraft, q = g.world.wobble.patches.find(r => r.id === 2); g.player.pos.set(q.x + 0.5, q.y + 4, q.z + 11.5); g.player.yaw = 0; g.player.pitch = 0; });
    await page.keyboard.down('w');
    await waitFor(page, () => ['enter', 'fight'].includes(window.pokecraft.scribble.info().phase), null, 60000).catch(() => {});
    await page.keyboard.up('w');
    const f2 = await page.evaluate(() => ({ phase: window.pokecraft.scribble.info().phase, patch: window.pokecraft.scribble.info().patch, riding: window.pokecraft.riding.on, y: window.pokecraft.player.pos.y }));
    t.ok(['enter', 'fight'].includes(f2.phase) && f2.patch === 2 && !f2.riding, `flying over a patch lands you in its fight (${JSON.stringify(f2)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('hops')) {
    // A3: paint-pot hops: the Camp's pot, a pot per cleared patch; look the way you want to go, E (or the big button) hops you there
    const { wobblePage } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    const yawTo = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
    const none = await page.evaluate(async () => { const g = window.pokecraft, M = await import('/src/wobblelive.js'), lv = g.gymLive.of('part:wobble'), q = M.potsOf(g.beaten)[0]; g.player.pos.set(q.x, q.y, q.z); await new Promise(r => setTimeout(r, 400)); return { info: lv.info(), near: lv.near(g.player) }; });
    t.ok(none.info.pots.join() === 'camp' && !none.near, `at first only the Camp has a paint pot, and it hops nowhere (${JSON.stringify(none)})`);
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); g.beaten.push(L.patchKey(1), L.patchKey(3)); });
    await frames(page, 3);
    const P = await page.evaluate(async () => (await import('/src/wobblelive.js')).potsOf(window.pokecraft.beaten));
    const [camp, p1, p3] = P;
    await page.evaluate(([q, yaw]) => { const g = window.pokecraft; g.player.pos.set(q.x, q.y, q.z); g.player.yaw = yaw; g.player.pitch = -0.05; }, [camp, yawTo(camp, p1)]);
    await frames(page, 4);
    const look1 = await page.evaluate(() => ({ prompt: document.getElementById('prompt')?.textContent, act: document.getElementById('btn-act')?.textContent, info: window.pokecraft.gymLive.of('part:wobble').info() }));
    t.ok(look1.info.pots.length === 3 && look1.info.to === 1 && look1.info.beam && /hop to red/i.test(look1.prompt), `two cleared patches: three pots; in the Camp's pot, looking toward patch 1, the beam stands over its red pot and the prompt says where (${JSON.stringify(look1)})`);
    await shot(page, 'wobble-pots.png');
    await page.evaluate(([yaw]) => { window.pokecraft.player.yaw = yaw; }, [yawTo(camp, p3)]);
    await frames(page, 3);
    const look3 = await page.evaluate(() => window.pokecraft.gymLive.of('part:wobble').info().to);
    t.ok(look3 === 3, `turning toward patch 3 picks its pot (${look3})`);
    await page.keyboard.press('e');
    await frames(page, 3);
    const at3 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
    t.ok(Math.hypot(at3.x - p3.x, at3.z - p3.z) < 2.5, `E hops you to patch 3's pot (${JSON.stringify(at3)})`);
    // back: step into it, look south toward the Camp, E
    await page.evaluate(([q, yaw]) => { const g = window.pokecraft; g.player.pos.set(q.x, q.y, q.z); g.player.yaw = yaw; }, [p3, yawTo(p3, camp)]);
    await frames(page, 3);
    await page.keyboard.press('e');
    await frames(page, 3);
    const home = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
    t.ok(Math.hypot(home.x - camp.x, home.z - camp.z) < 2.5, `and back to the Camp the same way (${JSON.stringify(home)})`);
    // a fight never hops, and nothing in a fight offers a hop
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
    // iPad: the big button says it and a tap hops
    const pad = await openGame(browser, base, { query: '?preview', contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(pad, 0);
    await intoWobble(pad);
    await pad.evaluate(async ([yaw]) => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), M = await import('/src/wobblelive.js'); g.beaten.push(L.patchKey(1)); const q = M.potsOf(g.beaten)[0]; g.player.pos.set(q.x, q.y, q.z); g.player.yaw = yaw; }, [yawTo(camp, p1)]);
    await frames(pad, 5);
    const word = await pad.evaluate(() => document.getElementById('btn-act')?.textContent);
    const box = await pad.locator('#btn-act').boundingBox();
    await pad.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await frames(pad, 4);
    const there = await pad.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
    t.ok(/Hop/.test(word) && Math.hypot(there.x - p1.x, there.z - p1.z) < 2.5, `on the iPad the round button says "${word}" and a tap hops you (${JSON.stringify(there)})`);
    t.ok(!pad.errors.length, `no page errors on the iPad (${pad.errors.join(' | ')})`);
    await pad.context().close();
  }

  if (want('bugs')) {
    // A2: scribble bugs. The rules with model players in Node at 60 / 20 fps, then real keys: corner one and walk into it
    const { runBugBots } = await import('../wobblebugbots.mjs');
    const r = runBugBots({ log: () => {} });
    for (const l of r.lines) t.ok(l.startsWith('ok'), l.replace(/^(ok {2}|FAIL) /, ''));
    for (const dev of [null, 'iPad (gen 7) landscape']) {
      const page = await openGame(browser, base, { query: '?preview', ...(dev ? { contextOptions: devices[dev] } : {}) });
      await newGame(page, 0);
      await intoWobble(page);
      await frames(page, 4);
      // a bug of patch 1 pinned at its yard's outer edge (north, on the grey), you 2.5 blocks inside it, looking at it (north: yaw 0)
      const set = await page.evaluate(async () => {
        const g = window.pokecraft, lv = g.gymLive.of('part:wobble'), L = await import('/src/wobbleland.js'), B = await import('/src/scribblebugs.js');
        const b = lv.field.bugs.find(q => q.patch === 1); b.x = b.cx; b.z = b.cz - B.BUG.outer; b.run = 1;
        g.player.pos.set(b.x, L.heightAt(Math.floor(b.x), Math.floor(b.z + 2.5)) + 1, b.z + 2.5); g.player.yaw = 0; g.player.pitch = -0.2;
        return { n: lv.info().bugs, id: b.id };
      });
      await frames(page, 3);
      if (!dev) await shot(page, 'wobble-bugs.png');
      // the kid keeps turning toward the bug while walking (as with the mouse or a look-drag: a bug slides off a straight walk)
      const steer = async () => { for (let k = 0; k < 200; k++) { const done = await page.evaluate(id => { const g = window.pokecraft, b = g.gymLive.of('part:wobble').field.bugs.find(q => q.id === id); if (b.popped) return true; g.player.yaw = Math.atan2(-(b.x - g.player.pos.x), -(b.z - g.player.pos.z)); return false; }, set.id); if (done) return; await page.waitForTimeout(100); } };
      if (!dev) { await page.keyboard.down('w'); await steer(); await page.keyboard.up('w'); }
      else {
        const jb = await page.locator('#joystick').boundingBox(), cdp = await page.context().newCDPSession(page), x0 = jb.x + jb.width / 2, y0 = jb.y + jb.height / 2; // (straight up from the stick's middle)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
        for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - k * 10, id: 1 }] });
        await steer();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await frames(page, 3);
      const got = await page.evaluate(id => { const g = window.pokecraft, lv = g.gymLive.of('part:wobble'), b = lv.field.bugs.find(q => q.id === id); return { popped: b.popped, left: lv.info().bugs, colour: g.wobbleLook.colourAt(b.x, b.z), bug: [b.x, b.z].map(Math.round), you: [g.player.pos.x, g.player.pos.z].map(Math.round) }; }, set.id);
      t.ok(set.n === 52 && got.popped && got.left === 51 && got.colour > 0.5, `${dev ? 'iPad, the joystick' : 'real keys, W'}: four bugs round each of the 13 patches (every region is open); one cornered at its yard's edge is walked into, pops and leaves a splash of colour (${JSON.stringify({ ...set, ...got })})`);
      // a cleared patch's bugs go
      const gone = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); g.beaten.push(L.patchKey(2)); for (let i = 0; i < 50 && g.gymLive.of('part:wobble').field.bugs.some(b => b.patch === 2); i++) await new Promise(r => setTimeout(r, 100)); return g.gymLive.of('part:wobble').field.bugs.filter(b => b.patch === 2).length; }); // (waits for a frame: the iPad page is slow)
      t.ok(gone === 0, `clearing a patch takes its bugs away (${gone} left)`);
      t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
      await page.context().close();
    }
  }

  if (want('springs')) {
    // C4 / C5: a hill floating on a string with a chest on top; walking or jumping never gets you up; the spring beside it (jump on it,
    // steer) does, with real keys; flying is capped below it (6 over the ground)
    const { wobblePage } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    const L0 = await page.evaluate(async () => { const L = await import('/src/wobbleland.js'); return { f: L.FLOATERS[0], g: L.heightAt(L.FLOATERS[0].spring[0], L.FLOATERS[0].spring[1]) }; });
    const f = L0.f, [sx, sz] = f.spring;
    // naive: walk to the hill and jump under it
    await page.evaluate(([x, y, z]) => { const g = window.pokecraft; g.player.pos.set(x, y, z); g.player.yaw = 0; }, [f.x + 0.5, L0.g + 1, f.z + 6.5]);
    await page.keyboard.down('w'); await page.keyboard.down('Space'); await page.waitForTimeout(4000); await page.keyboard.up('w'); await page.keyboard.up('Space');
    const naive = await page.evaluate(() => window.pokecraft.player.pos.y);
    t.ok(naive < f.y, `walking and jumping under the floating hill never gets you up (highest now ${naive.toFixed(1)}, its top ${f.y + 1})`);
    // skilled: stand on the spring, jump (Space), steer north (W) onto the hill
    await page.evaluate(([x, y, z]) => { const g = window.pokecraft; g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = 0.2; }, [sx + 0.5, L0.g + 1, sz + 0.5]);
    await frames(page, 2);
    await page.keyboard.down('Space'); await page.waitForTimeout(250); await page.keyboard.up('Space');
    await page.keyboard.down('w');
    await waitFor(page, ([x, z]) => { const p = window.pokecraft.player.pos; return p.z < z + 1.5 && p.y > 20; }, [f.x, f.z], 20000).catch(() => {});
    await page.keyboard.up('w');
    await page.waitForTimeout(1500);
    const up = await page.evaluate(() => { const p = window.pokecraft.player; return { y: p.pos.y, ground: p.onGround, x: p.pos.x, z: p.pos.z }; });
    t.ok(up.y >= f.y + 1 - 0.01 && up.y < f.y + 3, `jump on the spring and steer: you land on the floating hill (${JSON.stringify(up)})`);
    // the chest on top: look at it and press E
    await page.evaluate(([x, y, z]) => { const g = window.pokecraft; g.player.pos.set(x, y, z); g.player.yaw = 0; g.player.pitch = -0.6; }, [f.x + 0.5, f.y + 1, f.z + 2.3]);
    await frames(page, 4);
    const cubes0 = await page.evaluate(() => window.pokecraft.cubes);
    await page.keyboard.press('e');
    await frames(page, 3);
    const cubes1 = await page.evaluate(() => window.pokecraft.cubes);
    await page.evaluate(([x, y, z]) => { const g = window.pokecraft; g.player.pos.set(x, y, z); g.player.yaw = -0.25; g.player.pitch = 0.22; }, [f.x - 2.5, L0.g + 1, f.z + 15.5]); // (from the meadow: the spring, the hill on its string)
    await frames(page, 4);
    await shot(page, 'wobble-floating-hill.png');
    t.ok(cubes1 === cubes0 + 3, `the chest on top gives 3 Capture Cubes (${cubes0} -> ${cubes1})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('river')) {
    // owner 2026-11-11 ("floating river", nothing to press): step into the floating river by the Camp and it carries you uphill to a
    // floating hill, no keys pressed; freed creatures live near their own patch and up on the floating hills
    const { wobblePage } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    const R = await page.evaluate(async () => { const L = await import('/src/wobbleland.js'); return { r: L.RIVER_UP, g: L.heightAt(L.RIVER_UP.x0, L.RIVER_UP.z0 - 1), hill: L.FLOATERS.find(f => !f.spring) }; });
    await page.evaluate(([x, y, z]) => { const g = window.pokecraft; g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = -0.1; }, [R.r.x0 + 1, R.g + 1.2, R.r.z0 - 0.5]);
    await frames(page, 3);
    await shot(page, 'wobble-river.png');
    await waitFor(page, ([y]) => window.pokecraft.player.pos.y >= y && window.pokecraft.player.onGround, [R.hill.y + 1], 90000).catch(() => {});
    const up = await page.evaluate(() => { const p = window.pokecraft.player; return { x: +p.pos.x.toFixed(1), y: +p.pos.y.toFixed(1), z: +p.pos.z.toFixed(1), ground: p.onGround }; });
    t.ok(up.y >= R.hill.y + 1 - 0.01 && Math.hypot(up.x - R.hill.x - 0.5, up.z - R.hill.z - 0.5) < R.hill.r + 1.5, `no keys pressed: the floating river carries you uphill onto its floating hill (${JSON.stringify(up)}, the hill's top ${R.hill.y + 1})`);
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); g.player.pos.set(80.5, L.heightAt(80, 196) + 1, 196.5); g.player.yaw = 1.0; g.player.pitch = 0.12; });
    await frames(page, 4);
    await shot(page, 'wobble-river-up.png');
    // freed creatures: near their patch, and on the floating hills
    const sp = await page.evaluate(async () => {
      const g = window.pokecraft, L = await import('/src/wobbleland.js'), q = L.patchOf(3), out = { patch: [], float: [] };
      g.beaten.push(L.patchKey(3));
      for (let i = 0; i < 40; i++) { const a = L.wobbleSpot(g.world, 'patch3', { x: q.x, z: q.z }); if (a) out.patch.push(Math.round(Math.hypot(a.x - q.x, a.z - q.z))); const f = L.wobbleSpot(g.world, 'float', { x: 100, z: 180 }); if (f) out.float.push(L.FLOATERS.some(h => Math.hypot(f.x - h.x, f.z - h.z) < h.r && f.y === h.y + 1)); }
      g.player.pos.set(q.x + 0.5, q.y, q.z + 0.5);
      const ctx = g.creatures.context(g.player.pos, false); for (let i = 0; i < 300 && g.creatures.list.length < 6; i++) g.creatures.trySpawn(g.player.pos, g.spawnPoint ?? g.player.pos, ctx);
      out.wild = g.creatures.list.map(w => ({ sp: w.speciesId ?? w.data?.species, d: Math.round(Math.hypot(w.pos.x - q.x, w.pos.z - q.z)), when: w.when }));
      return out;
    });
    t.ok(sp.patch.length > 30 && sp.patch.every(d => d >= 3 && d <= 12) && sp.float.length > 5 && sp.float.every(Boolean), `freed creatures' spots: round their own patch (3-12 away) and on top of the floating hills (${sp.patch.length} / ${sp.float.length})`);
    t.ok(sp.wild.length > 0 && sp.wild.every(w => /^near:/.test(w.when)), `standing by cleared patch 3, its freed creatures appear (${JSON.stringify(sp.wild)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('patches')) {
    const { wobblePage, runPatches } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    const r = await runPatches(page, { games: 2, log: () => {} });
    for (const l of r.lines) t.ok(l.startsWith('ok'), l.replace(/^(ok {2}|FAIL) /, ''));
    // the real loop: W from the Camp side walks you into patch 1 (the nearest), the fight starts
    const p1 = await page.evaluate(() => { const g = window.pokecraft, q = g.world.wobble.patches.find(r => r.id === 1); g.player.pos.set(q.x + 0.5, q.y, q.z + 10.5); g.player.yaw = 0; g.player.pitch = 0; return { info: g.scribble.info(), cubes: g.cubes }; });
    await frames(page, 4);
    t.ok(p1.info.patch === 1 && p1.info.phase === 'idle', `in Wobbleland the live patch is the nearest one you have not cleared (${JSON.stringify({ patch: p1.info.patch, phase: p1.info.phase })})`);
    await page.keyboard.down('w');
    await waitFor(page, () => ['enter', 'fight'].includes(window.pokecraft.scribble.info().phase), null, 60000).catch(() => {});
    await page.keyboard.up('w');
    const f = await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); return F && { foes: F.foes.map(x => x.c.species), level: F.foes[0].c.level, you: F.squad.map(m => m.c.level) }; });
    t.ok(f && f.foes.join() === 'sproutle,hopsy,chirpit', `walking in starts the fight with the patch's own monsters (${JSON.stringify(f)})`);
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 60000).catch(() => {});
    await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); for (const x of F.foes) F.hit(F.you, x, 9999, 'normal'); });
    await waitFor(page, () => window.pokecraft.scribble.info().patch !== 1 && window.pokecraft.scribble.info().phase === 'idle', null, 90000).catch(() => {});
    await waitFor(page, () => !window.pokecraft.wobbleLook.info().floods, null, 30000).catch(() => {});
    const won = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); return { key: g.beaten.includes(L.patchKey(1)), cubes: g.cubes, next: g.scribble.info().patch, colour: g.wobbleLook.colourAt(L.patchOf(1).x, L.patchOf(1).z) }; });
    t.ok(won.key && won.cubes === p1.cubes + 3 && won.next && won.next !== 1 && won.colour > 0.5, `a win keeps patch 1 cleared (saved), +3 cubes, its colour floods back and the next patch is live (${JSON.stringify(won)})`);
    await page.evaluate(() => window.pokecraft.save?.(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await page.evaluate(() => [...document.querySelectorAll('#title-buttons button')].find(b => /Continue/.test(b.textContent))?.click());
    await placeIs(page, 'wobble');
    await frames(page, 6);
    const after = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); return { key: g.beaten.includes(L.patchKey(1)), patch: g.scribble.info().patch, colour: g.wobbleLook.colourAt(L.patchOf(1).x, L.patchOf(1).z) }; });
    t.ok(after.key && after.patch !== 1 && after.colour === 1, `after a reload patch 1 stays cleared and coloured (${JSON.stringify(after)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('loop')) {
    const { wobblePage } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    await frames(page, 6);
    await waitFor(page, () => /Smudge|Tangle/.test(document.querySelector('#guide')?.textContent || ''), null, 30000).catch(() => {}); // (the guide catches up a moment after you arrive)
    const r = await page.evaluate(async () => {
      const g = window.pokecraft, L = await import('/src/wobbleland.js');
      const ctx = () => g.creatures.context?.() ?? { after: id => false };
      const names = () => g.creatures.table('wobble').filter(e => !e[3] || ctx().after?.(e[3])).map(e => e[0]);
      const before = { chip: document.getElementById('score-chip')?.textContent, rows: g.nav.rows().filter(x => x.dest.id.startsWith('wobble:')).map(x => x.dest.id), guide: document.querySelector('#guide')?.textContent || '',
        people: g.npcs.list.filter(n => n.kind === 'healer' || /Wizard/.test(n.name)).map(n => n.name), freed: names() };
      for (const id of [1, 2, 3, 4, 5]) g.beaten.push(L.patchKey(id));
      await new Promise(res => setTimeout(res, 1500));
      const after = { chip: document.getElementById('score-chip')?.textContent, rows: g.nav.rows().filter(x => x.dest.id.startsWith('wobble:')).map(x => x.dest.id), freed: names(), line: L.wizardLine(1, 6) };
      return { before, after };
    });
    t.ok(/Puddle Meadow 0 \/ 6/.test(r.before.chip) && /Puddle Meadow 5 \/ 6/.test(r.after.chip), `the meter chip counts the region's patches (${r.before.chip} -> ${r.after.chip})`);
    t.ok(r.before.rows.length === 11 && !r.before.rows.includes('wobble:6') && !r.before.rows.includes('wobble:11') && r.after.rows[0] === 'wobble:6' && r.after.rows.length === 7, `"Where to go" has a row per open patch of every region, a knot only once its region's others are clear (${r.before.rows.join()} -> ${r.after.rows.join()})`);
    t.ok(/Smudge|Tangle/.test(r.before.guide), `the guide arrow leads to the nearest patch (${r.before.guide})`);
    t.ok(r.before.people.some(n => /Wizard/.test(n)) && r.before.people.length >= 2, `the Wizard and a healer are at Inkpot Camp (${r.before.people.join(', ')})`);
    t.ok(!r.before.freed.length && ['sproutle', 'hopsy', 'beetlet', 'hornbeetle'].every(sp => r.after.freed.includes(sp)) && !r.after.freed.includes('thornox'), `freed creatures live in the meadow once their patch is cleared (none before; after five: ${r.after.freed.join(', ')})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('ipad')) {
    const page = await openGame(browser, base, { query: '?preview', contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(page, 0);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('blazehound', 30), S.makeCreature('tidalord', 30), S.makeCreature('thunderwolf', 30)]; });
    await intoWobble(page);
    await page.evaluate(() => { const g = window.pokecraft, q = g.world.wobble.patches.find(r => r.id === 1); g.player.pos.set(q.x + 0.5, q.y, q.z + 10.5); g.player.yaw = 0; g.player.pitch = -0.1; });
    await frames(page, 6);
    const ui = await page.evaluate(() => ({ chip: document.getElementById('score-chip')?.textContent, touch: !document.getElementById('touch')?.classList.contains('hidden'), look: window.pokecraft.wobbleLook.info() }));
    await shot(page, 'wobble-ipad.png');
    t.ok(ui.touch && /Puddle Meadow/.test(ui.chip) && ui.look.on, `on the iPad: the touch controls, the meter chip and the look (${JSON.stringify({ chip: ui.chip, touch: ui.touch })})`);
    // the joystick (a finger dragged up on its left half) walks you into patch 1
    const vp = page.viewportSize(), cdp = await page.context().newCDPSession(page);
    const x0 = 140, y0 = vp.height - 160;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - k * 12, id: 1 }] });
    await waitFor(page, () => ['enter', 'fight'].includes(window.pokecraft.scribble.info().phase), null, 90000).catch(() => {});
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const ph = await page.evaluate(() => ({ phase: window.pokecraft.scribble.info().phase, fight: document.getElementById('touch')?.classList.contains('fight') }));
    t.ok(['enter', 'fight'].includes(ph.phase), `the joystick walks you into patch 1 and the fight starts (${JSON.stringify(ph)})`);
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 60000).catch(() => {});
    await frames(page, 4);
    await shot(page, 'wobble-ipad-fight.png');
    // owner 2026-11-11: the red warnings and the ring had vanished (the curl lifted them: they sit at the map's corner with their shape
    // in world places). Near you nothing of the fight may be lifted.
    const kept = await page.evaluate(() => { const g = window.pokecraft, grp = g.scene.getObjectByName('scribble'), ys = new Map(); grp?.traverse(o => { if (o.geometry && o.visible && o.parent?.visible !== false) ys.set(o, o.position.y); }); g.wobbleLook.beforeRender(); let moved = 0; for (const [o, y] of ys) if (Math.abs(o.position.y - y) > 1e-6) moved++; g.wobbleLook.afterRender(); return { n: ys.size, moved }; });
    t.ok(kept.n > 0 && kept.moved === 0, `in a fight the curl leaves the ring, the patch and the red warnings on the ground (${JSON.stringify(kept)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('knot')) {
    const { wobblePage } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    // the Grumble's rule, in the fight's own sums
    const g1 = await page.evaluate(async () => {
      const SF = await import('/src/scribblefight.js'), g = window.pokecraft, q = g.world.wobble.patches.find(r => r.id === 6), pf = SF.patchFight(q, q.y);
      const F = new SF.ScribbleFight({ ground: SF.groundOf(g.world), centre: pf.centre, squad: SF.squadOf(g.party), start: { x: pf.centre.x, y: pf.centre.y, z: pf.centre.z + 5 }, foes: pf.foes, levelStep: pf.levelStep, hp: pf.hp, attack: pf.attack });
      const G = F.foes.find(f => f.grumble), other = F.foes.find(f => !f.grumble), you = F.you;
      const at = (a) => { you.x = G.x + Math.sin(G.heading + a) * 3; you.z = G.z + Math.cos(G.heading + a) * 3; const h0 = G.hp; F.hit(you, G, 75, 'normal'); const d = h0 - G.hp; G.hp = h0; return d; };
      const front = at(0), back = at(Math.PI); G.openT = 1; const open = at(0);
      return { n: F.foes.length, big: G.r > other.r && G.maxHp > other.maxHp * 1.5, front, back, open, species: G.c.species };
    });
    t.ok(g1.n === 5 && g1.big && g1.front * 3 < g1.back && Math.abs(g1.open - g1.back) <= 1, `the knot: four monsters and a Grumble (${g1.species}, bigger and tougher); a hit on its front does ${g1.front}, on its back ${g1.back}, right after it struck ${g1.open}`);
    // the knot opens only after the other five; clear them, walk to it, and win
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); for (const id of [1, 2, 3, 4, 5]) g.beaten.push(L.patchKey(id)); const q = L.patchOf(6); g.player.pos.set(q.x + 0.5, 11, q.z + 13.5); g.player.yaw = 0; g.player.pitch = -0.1; });
    await waitFor(page, () => window.pokecraft.scribble.info().patch === 6, null, 30000).catch(() => {});
    await page.keyboard.down('w');
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 90000).catch(() => {});
    await page.keyboard.up('w');
    await frames(page, 6);
    await shot(page, 'wobble-knot.png');
    const inFight = await page.evaluate(() => window.pokecraft.scribble.fightOf()?.foes.map(f => f.c.species + (f.grumble ? '*' : '')));
    t.ok(inFight?.length === 5 && inFight.some(x => x.endsWith('*')), `walking into the knot starts its fight with the Grumble (${inFight})`);
    await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); for (const x of F.foes) { x.openT = 1; F.hit(F.you, x, 99999, 'normal'); } });
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'off' || (!window.pokecraft.scribble.fighting && window.pokecraft.scribble.info().phase !== 'exit'), null, 90000).catch(() => {});
    await waitFor(page, () => !window.pokecraft.wobbleLook.info().floods, null, 30000).catch(() => {});
    await frames(page, 6);
    const done = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), w = g.world; return { key: g.beaten.includes(L.patchKey(6)), chip: document.getElementById('score-chip')?.textContent, far: g.wobbleLook.colourAt(156, 216), lake: g.wobbleLook.colourAt(20, 160), rows: g.nav.rows().filter(x => x.dest.id.startsWith('wobble:')).map(x => x.dest.id).join() }; });
    t.ok(done.key && /6 \/ 6/.test(done.chip) && done.far === 1 && done.lake === 0 && !/wobble:[1-6]\b/.test(done.rows), `the knot cleared: the whole meadow is in colour, the lake still grey, only the lake's patches are left (${JSON.stringify(done)})`);
    await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(112.5, 18, 160.5); g.player.yaw = 0; g.player.pitch = -0.15; });
    await frames(page, 8);
    await shot(page, 'wobble-meadow-bright.png');
    await page.evaluate(() => window.pokecraft.save?.(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await page.evaluate(() => [...document.querySelectorAll('#title-buttons button')].find(b => /Continue/.test(b.textContent))?.click());
    await placeIs(page, 'wobble');
    await frames(page, 8);
    const re = await page.evaluate(() => ({ far: window.pokecraft.wobbleLook.colourAt(156, 216) }));
    t.ok(re.far === 1, `after a reload the meadow stays bright (${JSON.stringify(re)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('look')) {
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    // one fixed view of the main world, drawn straight to a buffer
    await page.evaluate(() => {
      const g = window.pokecraft;
      window.__grab = async () => { // only the world's blocks, in a fixed light (creatures, people, the sky and the clock move between the two pictures)
        const C = await import('/src/caves.js'), THREE = await import('three');
        window.__view(); const r = g.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight; g.world.cull(g.camera.position, g.scene.fog.far);
        const own = new Set(Object.values(g.world.materials)), hidden = [];
        for (const o of g.scene.children) if (o.visible && !(o.isMesh && own.has(o.material)) && !o.isLight) { o.visible = false; hidden.push(o); }
        const keep = [C.caveLight.uLit.value, C.caveLight.uLantern.value, g.scene.background, g.scene.fog.color.getHex()];
        C.caveLight.uLit.value = 1; C.caveLight.uLantern.value = 0; g.scene.background = new THREE.Color(0x8899aa); g.scene.fog.color.setHex(0x8899aa);
        r.render(g.scene, g.camera);
        for (const o of hidden) o.visible = true;
        [C.caveLight.uLit.value, C.caveLight.uLantern.value, g.scene.background] = keep; g.scene.fog.color.setHex(keep[3]); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); let h = 0; for (let i = 0; i < b.length; i += 7) h = (h * 31 + b[i]) >>> 0; return { h, defines: Object.values(g.world.materials).filter(m => m.defines?.WOBBLE).length }; };
      window.__view = () => { const g = window.pokecraft, s = g.spawnPoint; g.player.pos.copy(s); g.player.yaw = 0.7; g.player.pitch = -0.9; g.camera.position.set(s.x, s.y + 1.6, s.z); g.camera.rotation.set(-0.9, 0.7, 0); /* looking down: the Portal Door's spiral tile turns with the clock */ g.camera.updateMatrixWorld(); };
    });
    await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.studio.won = true; g.studio.ally = true; }); // (as the trip will: a Champion's Portal Door is drawn)
    await frames(page, 8);
    await page.evaluate(() => { window.pokecraft.paused = true; window.__view(); });
    const A = await page.evaluate(() => window.__grab());
    await page.evaluate(() => { window.pokecraft.paused = false; });
    await intoWobble(page);
    await frames(page, 8);
    const on = await page.evaluate(() => { const g = window.pokecraft; g.player.pitch = -0.02; return g.wobbleLook.info(); });
    t.ok(on.on && on.curl && on.defines.every(Boolean), `in Wobbleland the look is on: the WOBBLE define on the block materials, the page curls (${JSON.stringify(on)})`);
    const perf = await page.evaluate(() => { const g = window.pokecraft, r = g.renderer; let ms = 0; for (let i = 0; i < 3; i++) { const t0 = performance.now(); g.wobbleLook.beforeRender(); r.render(g.scene, g.camera); g.wobbleLook.afterRender(); ms += performance.now() - t0; } return { calls: r.info.render.calls, ms: Math.round(ms / 3) }; });
    await shot(page, 'wobble-look-curl.png');
    await page.evaluate(() => window.pokecraft.wobbleLook.toggleCurl());
    await frames(page, 4);
    const perf0 = await page.evaluate(() => { const g = window.pokecraft, r = g.renderer; let ms = 0; for (let i = 0; i < 3; i++) { const t0 = performance.now(); r.render(g.scene, g.camera); ms += performance.now() - t0; } return { calls: r.info.render.calls, ms: Math.round(ms / 3) }; });
    await shot(page, 'wobble-look-flat.png');
    console.log(`  draw calls / software frame time: curl on ${perf.calls} / ${perf.ms} ms, off ${perf0.calls} / ${perf0.ms} ms`);
    t.ok(perf.calls < 400, `draw calls in Wobbleland: ${perf.calls} (curl on), ${perf0.calls} (off)`);
    await page.evaluate(() => window.pokecraft.wobbleLook.toggleCurl());
    // the Scribble's grey and the flood: patch 1 cleared, its colour floods out
    const grey = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), p = L.patchOf(1); return { patch: g.wobbleLook.colourAt(p.x, p.z), camp: g.wobbleLook.colourAt(L.CAMP.x, L.CAMP.z) }; });
    t.ok(grey.patch === 0 && grey.camp === 1, `the Camp is in colour, the patches are grey (${JSON.stringify(grey)})`);
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), p = L.patchOf(1); g.beaten.push(L.patchKey(1)); g.wobbleLook.flood(1); g.player.pos.set(p.x + 0.5, 11, p.z + 22); g.player.yaw = 0; g.player.pitch = -0.2; });
    await frames(page, 3);
    const mid = await page.evaluate(async () => { const L = await import('/src/wobbleland.js'), p = L.patchOf(1); return window.pokecraft.wobbleLook.colourAt(p.x + 12, p.z); });
    await waitFor(page, () => !window.pokecraft.wobbleLook.info().floods, null, 30000).catch(() => {});
    const after = await page.evaluate(async () => { const L = await import('/src/wobbleland.js'), p = L.patchOf(1); return { mid: window.pokecraft.wobbleLook.colourAt(p.x, p.z), edge: window.pokecraft.wobbleLook.colourAt(p.x + 12, p.z), far: window.pokecraft.wobbleLook.colourAt(p.x + 30, p.z) }; });
    await frames(page, 3);
    await shot(page, 'wobble-look-flood.png');
    t.ok(mid < 1 && after.mid === 1 && after.edge === 1 && after.far === 0, `a cleared patch floods its colour out over about 2 s (12 blocks out: ${mid.toFixed(2)} at first, then ${JSON.stringify(after)})`);
    // home again: the main world draws the very same frame as before the trip
    await page.evaluate(() => window.pokecraft.realms.leave('stone', { home: true }));
    await placeIs(page, 'main');
    await frames(page, 4);
    await page.evaluate(() => { window.pokecraft.paused = true; window.__view(); });
    const B = await page.evaluate(() => window.__grab());
    t.ok(A.h === B.h && !A.defines && !B.defines, `the main world draws the same frame byte for byte before and after a trip to Wobbleland, no WOBBLE define on its materials (${A.h} / ${B.h})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('door')) {
    // without ?preview: no realm, no door, even for the Ally
    {
      const page = await openGame(browser, base);
      await newGame(page, 0);
      await intoSwirl(page);
      const r = await page.evaluate(async () => { const g = window.pokecraft, R = await import('/src/realms.js'), { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[0]; return { realm: !!R.REALMS.wobble, block: g.world.get(...c), paper: g.portal.info?.()?.paper }; });
      t.ok(!r.realm && r.block !== 129 && !r.paper, `without ?preview: no Wobbleland and no Paper Door, even for the Wizard's Ally (${JSON.stringify(r)})`);
      await page.context().close();
    }
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await intoSwirl(page, { ally: false });
    const before = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; const used = g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); return { paper: g.portal.info?.()?.paper, prompt: g.portal.prompt?.({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }, 'tap'), place: g.place }; });
    t.ok(!before.paper && before.place === 'swirl', `not yet the Wizard's Ally: no Paper Door, and its wall does not take you anywhere (${JSON.stringify(before)})`);
    await page.evaluate(() => { const g = window.pokecraft; g.studio.won = true; g.studio.ally = true; });
    await waitFor(page, () => window.pokecraft.portal.info?.()?.paper, null, 30000).catch(() => {});
    const door = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), pd = paperDoor(g.world); const s = pd.stand; g.player.pos.set(s[0], s[1], s[2]); g.player.yaw = 0; g.player.pitch = 0.1; return { paper: g.portal.info?.()?.paper, cells: pd.cells.map(c => g.world.get(...c)) }; });
    await frames(page, 6);
    await shot(page, 'wobble-door.png');
    t.ok(door.paper && door.cells.every(b => b === door.cells[0]), `the Wizard's Ally sees the Paper Door at the foot of his tower (${JSON.stringify(door)})`);
    await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
    await placeIs(page, 'wobble');
    const inside = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), p = g.player.pos; return { x: p.x, z: p.z, camp: Math.hypot(p.x - L.CAMP.x, p.z - L.CAMP.z), healer: !!g.world.healer, keep: !!g.world.editAllowed && !g.world.editAllowed(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z) - 3, 1) }; });
    t.ok(inside.camp < 6 && inside.healer && inside.keep, `in Wobbleland: you arrive at Inkpot Camp, a healer is there, nothing can be built (${JSON.stringify(inside)})`);
    await frames(page, 6);
    await shot(page, 'wobble-arrive.png');
    // saved inside: a reload puts you back in Wobbleland
    await page.evaluate(() => window.pokecraft.save?.(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await page.evaluate(() => [...document.querySelectorAll('#title-buttons button')].find(b => /Continue/.test(b.textContent))?.click());
    await placeIs(page, 'wobble');
    t.ok(true, 'a reload inside puts you back in Wobbleland');
    // back up with real keys: walk (W) up the steps to the way back, look at it and press E
    await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], s = d.stand; g.player.pos.set(s[0], s[1], s[2] - 2); g.player.yaw = Math.PI; g.player.pitch = 0; });
    await page.keyboard.down('w'); await page.keyboard.down('Space'); // (the steps: jump up them)
    await waitFor(page, () => { const g = window.pokecraft, s = g.world.doors[0].stand; return g.player.pos.z > s[2] + 0.6; }, null, 30000).catch(() => {});
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    await page.evaluate(() => { window.pokecraft.player.pitch = 0.15; });
    await frames(page, 3);
    await page.keyboard.press('e');
    await placeIs(page, 'swirl').catch(() => {});
    const back = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), s = paperDoor(g.world).stand; return { place: g.place, d: Math.hypot(g.player.pos.x - s[0], g.player.pos.z - s[2]) }; });
    t.ok(back.place === 'swirl' && back.d < 3, `W and Space up the steps and E on the way back take you up to the Paper Door on the Wizard's island (${JSON.stringify(back)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }
}
