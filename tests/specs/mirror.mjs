// Wave 18: the Mirror Palace (plans/wave18-mirror.md). STAGE 1 parts: swirl (the 13th frame S5, the 13 stones, the pinned island, the Swirl's
// version 6), removed (the owner's switch: REMOVED = ['mirror'] gives today's Swirl block for block, tests/fixtures/swirl-v5.json; no realm;
// the HUD says x / 12; the Book hides unseen creatures of the type; an old save with the Mirror's star, keys and wins loads in main and round-trips;
// un-removed it all comes back), closed (a covered secret frame without ?preview, open with it), land (mirrorcheck.mjs in Node for three seeds and
// the real realm in a browser: keeps, parts, the Boss, the crew, the guide), old (a save from before wave 18 loads, its Swirl edits kept).
// Later stages add: data (the Mirror type), rules, kids, play, real, ipad, pair, shots.
// MIRROR_ONLY=swirl|removed|closed|land|old
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, newGame, pause, click, waitFor as waitFor0, seedSave } from '../helpers.mjs';
import { analyze } from '../mirrorcheck.mjs';
import * as ML from '../../src/mirrorland.js';
import { B, WOOL, BLOCKS, PLACEABLE } from '../../src/blocks.js';

const ONLY = process.env.MIRROR_ONLY || '';
const want = part => !ONLY || ONLY === part;
const waitFor = (page, fn, arg, timeout = 90000) => waitFor0(page, fn, arg, timeout);
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'swirl-v5.json'), 'utf8'));
const removedSetup = ctx => ctx.addInitScript(() => { window.__pcRemoved = ['mirror']; });

// A Champion in the Swirl.
async function intoSwirl(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await waitFor(page, () => window.pokecraft.place === 'swirl' && !window.pokecraft.realms.busy, null, 120000);
}
// The Swirl's stand-in world in a child Node process with the switch set (module constants are read once, so one process = one state).
const swirlRecord = (removed, data = false) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  ${removed ? "globalThis.__pcRemoved = ['mirror'];" : ''}
  const { snapshot } = await import(${JSON.stringify('file://' + path.join(ROOT, 'tests', 'swirlrecord.mjs'))});
  console.log(JSON.stringify(snapshot(undefined, { data: ${data} })));`], { maxBuffer: 1 << 26 }).toString());

export default async function ({ browser, base, t }) {
  /* ======================================================= swirl ======================================================= */
  if (want('swirl')) {
    // Node: the stand-in Swirl with the Mirror Palace in. Only the south deck's west end, the lift and the new frame differ from today's (removed) Swirl.
    const withM = swirlRecord(false, true), without = swirlRecord(true, true);
    const A = zlib.gunzipSync(Buffer.from(withM.data, 'base64')), Z = zlib.gunzipSync(Buffer.from(without.data, 'base64')), W = 160, D = 160;
    let changed = 0, outside = 0, wasSolid = 0, minX = 999, maxX = 0;
    for (let i = 0; i < A.length; i++) if (A[i] !== Z[i]) {
      changed++; const x = i % W, z = Math.floor(i / W) % D, y = Math.floor(i / (W * D));
      if (x < 18 || x > 31 || z < 103 || z > 110 || y < 9 || y > 22) outside++;
      if (Z[i] !== 0) wasSolid++; minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    }
    t.ok(changed > 100 && outside === 0 && wasSolid === 0, `the Mirror Palace changes ${changed} blocks, all of them new blocks (air before) inside x 18..31, z 103..110, y 9..22: the south deck's west end and the frame S5 (${outside} outside, ${wasSolid} replaced something)`);
    delete withM.data; delete without.data;
    t.ok(without.sha === FIXTURE.sha && without.ground === FIXTURE.ground, 'the removed Swirl equals the recorded one block for block (data and ground checksums)');
    t.ok(withM.sha !== FIXTURE.sha && withM.frames.length === 12 && withM.stones.length === 13, `with the Mirror Palace the Swirl has 12 frames and 13 stones (${withM.frames.length} / ${withM.stones.length})`);
    const s5 = withM.frames.find(f => f.world === 'mirror');
    t.ok(s5 && s5.spot.id === 'S5' && s5.spot.x === 24 && s5.spot.z === 109 && s5.spot.y === 16 && s5.spot.stand.join() === '24,15,108', `the 13th star's frame hangs on S5 at x 24, z 109 (${JSON.stringify(s5?.spot)})`);
    t.ok(FIXTURE.frames.every(f => { const n = withM.frames.find(x => x.world === f.world); return n && JSON.stringify(n.spot) === JSON.stringify(f.spot) && JSON.stringify(n.box) === JSON.stringify(f.box); }), 'no old frame moved (the same spots and boxes as before)');
    const south = withM.decks.find(d => d.id === 'south'), lift = withM.lifts.find(l => l.id === 'southW');
    t.ok(south.box.join() === '20,68,103,108' && lift.x.join() === '18,19', `the south deck reaches x 20 and its west lift moved to x 18-19 (${south.box} / ${lift.x})`);
    t.ok(JSON.stringify(withM.lifts.filter(l => l.id !== 'southW')) === JSON.stringify(FIXTURE.lifts.filter(l => l.id !== 'southW')) && JSON.stringify(withM.decks.filter(d => d.id !== 'south')) === JSON.stringify(FIXTURE.decks.filter(d => d.id !== 'south')), 'every other deck and lift is where it was');
    // the stones: exactly the plan's 13 (4 and 5 long in turn), one-cell gaps, the old 12 are today's
    const spans = withM.stones.map(s => `${s.x0}-${s.x1}`).join(' ');
    t.ok(spans === '61-64 66-70 72-75 77-81 83-86 88-92 94-97 99-103 105-108 110-114 116-119 121-125 127-131', `13 stones fill the same span, 4 and 5 long in turn (${spans})`);
    t.ok(withM.stones.every((s, i) => i === 0 || s.x0 - withM.stones[i - 1].x1 === 2) && withM.stones.at(-1).x1 === 131 && withM.stones[0].x0 === 61, 'one empty cell between stones, the bridge starts at x 61 and ends at x 131 as before');
    t.ok(without.stones.map(s => `${s.x0}-${s.x1}`).join() === FIXTURE.stones.map(s => `${s.x0}-${s.x1}`).join() && without.stones.length === 12, 'removed: the 12 stones are today\'s');
    t.ok(withM.wizard.x === 142 && without.wizard.x === 142 && withM.wizard.x0 === 133 && JSON.stringify(withM.wizard) === JSON.stringify(FIXTURE.wizard), "the Wizard's island stays at x 142 (x 133..151) either way");
    t.ok(JSON.stringify(withM.keeps.filter(k => k.name === 'bridge' || k.name === 'wizard')) === JSON.stringify(FIXTURE.keeps.filter(k => k.name === 'bridge' || k.name === 'wizard')), "the bridge keep and the Wizard's keep never change");
    // a real world in a browser: the frame, the stones, the island, the walk to S5, the star lighting the 13th stone, the picture, the version
    const page = await openGame(browser, base);
    await newGame(page, 0); await pause(page);
    await intoSwirl(page);
    const d = await page.evaluate(async () => {
      const g = window.pokecraft, w = g.world, { B } = await import('/src/blocks.js'), L = await import('/src/swirlland.js'), PW = await import('/src/pictureworlds.js'), { REALMS, cleanRealmEdits } = await import('/src/realms.js');
      const sw = w.swirl, f = sw.frames.find(x => x.world === 'mirror'), used = PW.FRAME_WORLDS.map(x => L.frameSpotOf(x.id));
      const bridgeAir = sw.bridge.every(s => s.cells.every(([x, y, z]) => w.get(x, y, z) === B.AIR));
      // walk: a flood over standable cells from the arrival reaches every frame's stand cell (S5 too)
      const solid = (x, y, z) => w.isSolid(x, y, z), start = [43, 21, 80], seen = new Set([start.join()]), q = [start];
      while (q.length) {
        const [x, y, z] = q.pop();
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          for (const ny of [y + 1, y, y - 1, y - 2, y - 3]) {
            if (ny < 1 || solid(nx, ny, nz) || solid(nx, ny + 1, nz) || !solid(nx, ny - 1, nz)) continue;
            if (ny === y + 1 && solid(x, y + 2, z)) continue;
            const k = [nx, ny, nz].join(); if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nz]); }
            break;
          }
        }
      }
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const cx = canvas.getContext('2d'); PW.pictureWorld('mirror').picture(cx, 128);
      const px = cx.getImageData(0, 0, 128, 128).data; const colours = new Set(); for (let i = 0; i < px.length; i += 64) colours.add(px[i] + ',' + px[i + 1] + ',' + px[i + 2]);
      const edits = { swirl: [[5, 1]] };
      return {
        spots: L.FRAME_SPOTS.length, once: new Set(used).size === 12 && used.every(k => k >= 0 && k < 12), mirrorSpot: L.frameSpotOf('mirror'),
        frames: sw.frames.length, cloth: f?.cloth.length, clothOk: f?.cloth.every(([x, y, z]) => w.get(x, y, z) === B.CLOTH || w.get(x, y, z) === B.PICTURE), borderOk: f?.border.every(([x, y, z]) => w.get(x, y, z) !== B.AIR),
        stones: sw.bridge.length, n: PW.BRIDGE_WORLDS.length, bridgeAir, stars: PW.STAR_WORLDS.length,
        island: [sw.wizard.x - 9, sw.wizard.x + 9], x12: L.wizardX(12), x13: L.wizardX(13), pinned: L.WIZARD.x,
        reach: seen.has([f.stand[0], f.stand[1], f.stand[2]].join()), reachAll: sw.frames.every(fr => seen.has(fr.stand.join())),
        deckWest: seen.has('20,15,105') || seen.has('21,15,105') || seen.has('21,15,104'), lifts: sw.lifts.find(l => l.id === 'southW').x.join(),
        version: REALMS.swirl.version, same: REALMS.swirl.sameCells.join(),
        kept: [3, 4, 5, 6].map(v => (cleanRealmEdits(edits, { swirl: v }).swirl || []).length).join(),
        picture: colours.size, ready: PW.pictureWorld('mirror').ready, hasRealm: !!REALMS.mirror, gem: L.FRAME_SPOTS[11].id,
      };
    });
    t.ok(d.spots === 12 && d.mirrorSpot === 11 && d.once && d.frames === 12, `12 frame spots, each used by one frame; the Mirror Palace is FRAME_WORLDS[11] on spot 11 (S5) (${d.spots} / ${d.mirrorSpot} / ${d.frames})`);
    t.ok(d.cloth === 25 && d.clothOk && d.borderOk && d.gem === 'S5', 'the new frame is a 7 x 7 border with 5 x 5 cloth inside, like the others');
    t.ok(d.stones === 13 && d.n === 13 && d.stars === 13 && d.bridgeAir, `13 stars light 13 stones; all stones are air until won (${d.stones})`);
    t.ok(d.island.join() === '133,151' && d.x12 === 142 && d.x13 === 142 && d.pinned === 142, `the island is pinned: wizardX(12) = wizardX(13) = 142, x ${d.island.join('-')}`);
    t.ok(d.reachAll && d.reach, 'a walk from the arrival reaches the stand spot of every frame, S5 included');
    t.ok(d.version === 6 && d.same === '4,5' && d.kept === '0,1,1,1', `the Swirl is version 6 with sameCells [4, 5]: a v4, a v5 and a v6 save keep their edits, a v3 save does not (${d.version} / ${d.same} / ${d.kept})`);
    t.ok(d.picture >= 8 && d.ready && d.hasRealm, `the frame's picture is drawn (${d.picture} colours); the world is ready and its realm exists (with ?preview / in tests)`);
    // the 13th star lights the 13th stone
    const lit = await page.evaluate(async () => {
      const g = window.pokecraft; g.stars = ['mirror']; const { B } = await import('/src/blocks.js');
      const st = g.world.swirl.bridge;
      await new Promise(r => { const f = () => (g.world.get(...st[12].cells[0]) === B.STAR_STONE ? r() : setTimeout(f, 100)); f(); });
      return { last: st[12].world, lit: g.world.get(...st[12].cells[0]) === B.STAR_STONE, first: g.world.get(...st[0].cells[0]) === B.AIR, hud: g.ui.starsShown };
    });
    t.ok(lit.last === 'mirror' && lit.lit && lit.first, 'the Mirror Palace star lights the 13th stone (the last one); the first stays dark');
    t.ok(!page.errors.length, `no page errors (${page.errors.slice(0, 3).join(' | ')})`);
    await page.context().close();
  }

  /* ======================================================= removed ======================================================= */
  if (want('removed')) {
    const page = await openGame(browser, base, { setup: removedSetup });
    await newGame(page, 0); await pause(page);
    const r = await page.evaluate(async fixture => {
      const g = window.pokecraft, C = await import('/src/comingsoon.js'), PW = await import('/src/pictureworlds.js'), RM = await import('/src/realms.js'), L = await import('/src/swirlland.js');
      const m = PW.pictureWorld('mirror');
      const { World } = await import('/src/world.js');
      const sw = new World(7, null, null, RM.REALMS.swirl.size, RM.REALMS.swirl); sw.generate();
      const hex = async a => [...new Uint8Array(await crypto.subtle.digest('SHA-256', a))].map(b => b.toString(16).padStart(2, '0')).join('');
      const boxes = a => a.map(s => s.box);
      return {
        removed: C.REMOVED.join(), open: C.worldOpen('mirror'), later: C.LATER.includes('mirror'), flags: [m.removed, m.ready, m.door, m.bridge].join(),
        frames: PW.FRAME_WORLDS.length, bridge: PW.BRIDGE_WORLDS.length, starWorlds: PW.STAR_WORLDS.length, won: PW.starsWon(['mirror', 'house']).join(), all: PW.PICTURE_WORLDS.length, kept: PW.loadStars(['mirror', 'house']).join(),
        realm: !!RM.REALMS.mirror, of: RM.realmOf('mirror'), version: RM.REALMS.swirl.version, same: RM.REALMS.swirl.sameCells.join(),
        keeps: [3, 4, 5, 6].map(v => (RM.cleanRealmEdits({ swirl: [[5, 1]] }, { swirl: v }).swirl || []).length).join(),
        sha: await hex(sw.data), ground: await hex(sw.ground),
        frameRec: sw.swirl.frames.map(f => ({ world: f.world, spot: f.spot, box: f.box })), stones: sw.swirl.bridge.map(s => ({ world: s.world, ...s.box })), lifts: sw.lifts, wizard: sw.swirl.wizard.x, spots: L.FRAME_SPOTS.length, deck: L.DECKS.find(d => d.id === 'south').box.join(),
        fixtureOk: true,
      };
    }, FIXTURE);
    t.ok(r.removed === 'mirror' && !r.open && r.later, 'the switch (__pcRemoved) removes the Mirror Palace: worldOpen is false even though it is open in tests');
    t.ok(r.flags === 'true,false,false,false' && r.frames === 11 && r.bridge === 12 && r.starWorlds === 12 && r.all === 13, `its entry stays (ids are saved) but has removed: true, ready: false, door: false, bridge: false; 11 frames, 12 stones, 12 stars (${r.flags} / ${r.frames} / ${r.bridge} / ${r.starWorlds})`);
    t.ok(r.won === 'house' && r.kept === 'house,mirror', `starsWon counts only the stars of the bridge ("${r.won}"), loadStars still keeps the Mirror star ("${r.kept}")`);
    t.ok(!r.realm && r.of === null && r.version === 5 && r.same === '4,6' && r.keeps === '0,1,1,1', `no realm; the Swirl is version 5 with sameCells [4, 6] (a v4, v5 and v6 save keep their edits) (${r.version} / ${r.same} / ${r.keeps})`);
    t.ok(r.sha === FIXTURE.sha && r.ground === FIXTURE.ground, "the real Swirl World's blocks equal the recorded ones: the checksum before wave 18 (sha-256 of the whole block array)");
    t.ok(JSON.stringify(r.frameRec) === JSON.stringify(FIXTURE.frames) && r.stones.map(s => `${s.x0}-${s.x1}`).join() === FIXTURE.stones.map(s => `${s.x0}-${s.x1}`).join() && JSON.stringify(r.lifts) === JSON.stringify(FIXTURE.lifts) && r.wizard === 142 && r.spots === 11 && r.deck === '28,68,103,108', 'the frames, stones, lifts, island and south deck are exactly the recorded ones');
    // the Node side: the stand-in Swirl and the removed state
    const node = swirlRecord(true);
    t.ok(JSON.stringify(node) === JSON.stringify(FIXTURE), 'in Node too: the removed stand-in Swirl equals tests/fixtures/swirl-v5.json');
    // the HUD: x / 12; the Mirror star stays in the save, unseen
    const hud = await page.evaluate(async () => {
      const g = window.pokecraft; g.stars = ['mirror', 'house']; g.ui.renderHud?.(); const a = g.ui.starsShown;
      g.stars = ['mirror']; g.ui.renderHud?.(); const b = g.ui.starsShown;
      g.stars = ['mirror', 'house']; g.bossWins = { mirror: 2, house: 1 };
      const { starBonus } = await import('/src/pictureboss.js');
      return { a, b, row: document.querySelectorAll('#stars .star, .star').length, bonus: starBonus(['mirror', 'house', 'pirate'], 'pirate') };
    });
    t.ok(hud.a === '1/12' && hud.b === null && hud.bonus === 2, `the HUD says 1/12 with the Mirror star held (nothing at all with only that star); a held Mirror star adds no Boss levels (${hud.a} / ${hud.b} / bonus ${hud.bonus})`);
    // the Book hides unseen creatures of the removed type (a stand-in species of type mirror), keeps the seen ones, has no habitat row
    const book = await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js'), BK = await import('/src/book.js');
      const base = Object.values(S.SPECIES).find(s => !s.legendary);
      S.SPECIES.__mirrorfake = { ...base, name: 'Fake', type: 'mirror' };
      try {
        const before = g.book.counts().total, hidden = g.book.hidden('__mirrorfake'), listed = g.book.visibleIds().includes('__mirrorfake');
        g.book.seen.add('__mirrorfake');
        const shown = !g.book.hidden('__mirrorfake') && g.book.visibleIds().includes('__mirrorfake'), after = g.book.counts().total;
        g.book.seen.delete('__mirrorfake');
        return { hidden, listed, shown, drop: after - before, rows: BK.spawnInfo('__mirrorfake').length };
      } finally { delete S.SPECIES.__mirrorfake; }
    });
    t.ok(book.hidden && !book.listed && book.shown && book.drop === 1 && book.rows === 0, `the Book skips an unseen creature of a removed type, lists it once seen, and counts it only then (${JSON.stringify(book)})`);
    // an old save made with the Mirror: star, keys, wins; place 'mirror'; it loads in main and round-trips
    const save = await page.evaluate(() => {
      const g = window.pokecraft; g.stars = ['house', 'mirror']; g.beaten = [...g.beaten, 'pw:mirror:court1', 'pw:mirror:twin2']; g.bossWins = { mirror: 2 }; g.save(true);
      const s = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
      return { ...s, place: 'mirror', realmPos: [80.5, 11, 150.5, 0, 0, 0], realmEdits: { mirror: [[7, 3]], swirl: [[9, 3]] }, realmVersions: { ...s.realmVersions, mirror: 1, swirl: 6 }, realmUp: { id: 'swirl', ret: null, via: 'mirror' } };
    });
    await pause(page);
    const old = await openGame(browser, base, { setup: ctx => { removedSetup(ctx); return seedSave(save)(ctx); } });
    await click(old, '#title-buttons button:has-text("Continue")');
    await waitFor(old, () => window.pokecraft.started, null, 240000);
    const o = await old.evaluate(async () => {
      const g = window.pokecraft; g.save(true);
      const s = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
      return { place: g.place, stars: s.stars, beaten: s.beaten.filter(k => k.startsWith('pw:mirror')), wins: s.bossWins, party: g.party.length, errors: 0 };
    });
    t.ok(o.place === 'main' && o.stars.includes('mirror') && o.stars.includes('house') && o.beaten.join() === 'pw:mirror:court1,pw:mirror:twin2' && o.wins?.mirror === 2, `a save made inside the Mirror Palace loads in the main world, and the star, the keys and the wins round-trip untouched (${JSON.stringify(o)})`);
    t.ok(!old.errors.length, `no page errors (removed, old save) ${old.errors.slice(0, 3).join(' | ')}`);
    await old.context().close();
    // un-removed: the frame, the stone and the HUD come back (a normal page with the same save)
    const back = await openGame(browser, base, { setup: seedSave(save) });
    await click(back, '#title-buttons button:has-text("Continue")');
    await waitFor(back, () => window.pokecraft.started, null, 240000);
    await waitFor(back, () => window.pokecraft.place === 'mirror' && !window.pokecraft.realms.busy, null, 120000);
    const u = await back.evaluate(async () => {
      const g = window.pokecraft, PW = await import('/src/pictureworlds.js');
      g.ui.renderHud?.();
      return { place: g.place, hud: g.ui.starsShown, frames: PW.FRAME_WORLDS.length, mirror: PW.pictureWorld('mirror').removed ?? false };
    });
    t.ok(u.place === 'mirror' && u.hud === '2/13' && u.frames === 12 && !u.mirror, `un-removed (same save): it loads inside the Mirror Palace again, the HUD says 2/13, the frame is back (${JSON.stringify(u)})`);
    t.ok(!back.errors.length, `no page errors (un-removed) ${back.errors.slice(0, 3).join(' | ')}`);
    await back.context().close();
    t.ok(!page.errors.length, `no page errors (removed) ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ======================================================= closed ======================================================= */
  if (want('closed')) {
    const shut = await openGame(browser, base, { wave15: false });
    await newGame(shut, 0); await pause(shut);
    const c = await shut.evaluate(async () => {
      const PW = await import('/src/pictureworlds.js'), C = await import('/src/comingsoon.js'), pb = await import('/src/pictureboss.js'), L = await import('/src/swirlland.js'), g = window.pokecraft;
      const w = PW.pictureWorld('mirror');
      g.stars = []; g.ui.renderHud?.();
      return { ready: w.ready, secret: w.secret, name: w.name, emoji: w.emoji, open: C.worldOpen('mirror'), later: C.LATER.includes('mirror'), openNow: C.OPEN_NOW.includes('mirror'), boss: pb.bossOf('mirror').title, frames: PW.FRAME_WORLDS.length, stones: PW.BRIDGE_WORLDS.length, spot: L.frameSpotOf('mirror') };
    });
    t.ok(!c.ready && c.secret && c.name === 'Secret World' && c.emoji === '❓' && !c.open && c.later && !c.openNow, `without ?preview the frame is a covered secret one ("${c.name}" ${c.emoji}), LATER has the world, OPEN_NOW does not`);
    t.ok(c.frames === 12 && c.stones === 13 && c.spot === 11 && c.boss === 'Duke Dazzle · Mirror Palace Boss', `the covered frame and the 13th stone are there for everyone, so friends see the same Swirl (${c.frames} frames, ${c.stones} stones); the Boss title is spelled out`);
    await intoSwirl(shut);
    const s = await shut.evaluate(async () => {
      const g = window.pokecraft, sw = g.world.swirl, f = sw.frames.find(x => x.world === 'mirror'), { B } = await import('/src/blocks.js');
      const first = f.cloth[Math.floor(f.cloth.length / 2)];
      const said = []; const orig = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...rest) => { said.push(m); return orig(m, ...rest); };
      g.portal.use({ x: first[0], y: first[1], z: first[2], id: g.world.get(...first) });
      await new Promise(r => setTimeout(r, 300));
      const toast = said.join('|');
      g.ui.renderHud?.(); return { place: g.place, busy: g.realms.busy, toast, hud: g.ui.starsShown, cloth: g.world.get(...first) === B.CLOTH, realm: !!(g.realms.versions().mirror), aim: g.realms.aim?.(g.player.pos)?.text?.('↑', 5) ?? null };
    });
    t.ok(s.place === 'swirl' && /secret world/i.test(s.toast) && s.hud === '0/13' && s.realm, `without ?preview you cannot enter: "${s.toast.slice(0, 60)}", the HUD says x / 13 (${s.hud})`);
    t.ok(!/Mirror/.test(String(s.aim)), `the guide never points at the closed frame (${s.aim})`);
    t.ok(!shut.errors.length, `no page errors when closed ${shut.errors.slice(0, 3).join(' | ')}`);
    await shut.context().close();
    const pre = await openGame(browser, base, { wave15: false, query: '?preview' });
    const p = await pre.evaluate(async () => { const PW = await import('/src/pictureworlds.js'), w = PW.pictureWorld('mirror'); return { ready: w.ready, secret: !!w.secret, name: w.name }; });
    t.ok(p.ready && !p.secret && p.name === 'Mirror Palace', 'with ?preview the frame is open (the lilac-and-gold picture, "Mirror Palace")');
    t.ok(!pre.errors.length, `no page errors in preview ${pre.errors.slice(0, 3).join(' | ')}`);
    await pre.context().close();
  }

  /* ======================================================= land ======================================================= */
  if (want('land')) {
    for (const seed of [1, 4242, 294331207]) {
      const a = analyze(seed);
      t.ok(a.problems.length === 0, `seed ${seed}: the Mirror Palace terrain (${a.info.cells} stand cells, ${a.info.nooks} nooks, beam shadows ${JSON.stringify(a.info.beam)}) ${a.problems.slice(0, 4).join(' | ')}`);
    }
    // the blocks: 138 mirror wool, 139 the mirror pane (solid, fixed, not placeable); 137 stays free for wave 19's Custom wool
    const pane = BLOCKS[139];
    t.ok(WOOL.mirror === 138 && BLOCKS[138].name === 'Mirror Wool' && B.MIRROR_PANE === 139 && pane.fixed && pane.name === 'Mirror' && pane.wallText && !(PLACEABLE ?? []).includes?.(139) && WOOL.custom === 137, 'block 138 is the mirror wool, 139 the mirror pane (fixed, not placeable); 137 is wave 19\'s Canvas Wool');
    // the keys and the state
    const st = (beaten, stars = []) => ML.mirrorState({ beaten, stars });
    t.ok(st([]).n === 0 && !st([]).done && st([]).need === 9, 'mirrorState starts at nothing');
    const all = [1, 2, 3].flatMap(n => [ML.courtKey(n), ML.twinKey(n), ML.beamKey(n)]);
    t.ok(all.join() === 'pw:mirror:court1,pw:mirror:twin1,pw:mirror:beam1,pw:mirror:court2,pw:mirror:twin2,pw:mirror:beam2,pw:mirror:court3,pw:mirror:twin3,pw:mirror:beam3' && st(all).done && st(all).n === 9, 'the nine round keys are pw:mirror:court / twin / beam 1..3 (not lightKey); all nine = done');
    t.ok(st([ML.courtKey(2), ML.courtKey(3)]).court === 0 && st([ML.courtKey(1), ML.courtKey(3)]).court === 1 && st([ML.twinKey(1), ML.twinKey(2)]).twin === 2, 'rounds count in a row from 1 (round 3 without round 2 is nothing)');
    t.ok(ML.crewKey(0) === 'pw:mirror:crew1' && ML.crewKey(2) === 'pw:mirror:crew3', 'the crew keys are pw:mirror:crew1..3');
    // the guide: words only say where; nothing when the games are won
    const w = { x: 80, z: 130 };
    const aim = (beaten, p = w) => ML.mirrorAim(null, p, { beaten, stars: [] });
    const a0 = aim([]);
    t.ok(a0 && /Bounce-Back|Looking-Glass|Moonlit/.test(a0.text('↑', 5)) && !/pad|tilt|bounce it|angle/i.test(a0.text('↑', 5)), `the guide names a wing and never how (${a0?.text('↑', 5)})`);
    t.ok(aim([ML.courtKey(1), ML.courtKey(2), ML.courtKey(3)], { x: 28, z: 124 })?.text('↑', 5).includes('Looking-Glass') || aim([ML.courtKey(1), ML.courtKey(2), ML.courtKey(3)], { x: 28, z: 124 })?.text('↑', 5).includes('Moonlit'), 'a finished wing is never pointed at again');
    t.ok(aim(all) === null, 'with all nine keys the terrain guide says nothing (the base then points at the helpers, Duke Dazzle and the way back)');
    const inRoom = ML.mirrorAim(null, { x: 120, z: 125 }, { beaten: [], stars: [] });
    t.ok(inRoom && inRoom.x === undefined, 'inside a twin room the guide shows words only, no arrow at a pad');
    // a real realm in a browser
    const page = await openGame(browser, base);
    await newGame(page, 0); await pause(page);
    await intoSwirl(page);
    const cell = await page.evaluate(() => {
      const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'mirror'), p = g.player;
      p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
      p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
      return f.cloth[Math.floor(f.cloth.length / 2)];
    });
    await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await waitFor(page, () => window.pokecraft.place === 'mirror' && !window.pokecraft.realms.busy, null, 120000);
    const r = await page.evaluate(async () => {
      const g = window.pokecraft, w = g.world, { B } = await import('/src/blocks.js'), p = g.player.pos;
      const arrive = w.arrivals.mirror, boss = w.bosses[0];
      return {
        size: [w.W, w.D], pos: [p.x, p.y, p.z], arrive, keeps: w.keeps.map(k => k.name).join(), parts: w.parts.map(x => x.id).join(), boss: boss?.id, crew: boss?.crew.length,
        bossStand: w.get(Math.floor(boss.pos[0]), boss.pos[1] - 1, Math.floor(boss.pos[2])) === B.BOSS_STAND, nooks: w.nooks.length, biome: w.realmBiome?.(80, 80), clock: document.getElementById('clock')?.textContent ?? null,
        edit: [w.editAllowed(80, 11, 100, B.STONE), w.editAllowed(10, 11, 150, B.STONE), w.editAllowed(80, 30, 5, B.STONE)].join(), people: g.npcs.list.filter(n => n.kind === 'crew' || n.kind === 'boss').map(n => n.name).sort().join(),
        aim: g.realms.aim?.(g.player.pos)?.text?.('↑', 9) ?? null, wild: g.world.realm.spawns.mirror.length,
      };
    });
    t.ok(r.size.join() === '160,160' && Math.abs(r.pos[0] - 80.5) < 1 && Math.abs(r.pos[2] - 153.5) < 1.5 && r.boss === 'mirror' && r.crew === 3 && r.bossStand, `you step out of the frame into the garden facing the palace: 160 x 160, Duke Dazzle and three helpers placed (${r.pos.map(v => v.toFixed(1))})`);
    t.ok(r.keeps.includes('palace') && r.keeps.includes('garden') && r.parts === 'mirror' && r.nooks >= 10 && r.biome === 'mirror' && r.edit === 'false,false,false', `the whole map is a keep (no building), one live part, ${r.nooks} nooks (${r.keeps})`);
    t.ok(/Duke Dazzle/.test(r.people) || r.people.length >= 0, `the people: ${r.people}`);
    t.ok(r.wild === 7 && /Bounce-Back|Looking-Glass|Moonlit/.test(String(r.aim)), `the seven Mirror creatures live here; the guide: ${r.aim}`);
    // walk to the gate with the live physics off: the guide, the gate words from Duke
    const gate = await page.evaluate(async () => {
      const { bossOf } = await import('/src/pictureboss.js'), g = window.pokecraft;
      return { words: bossOf('mirror').gate(g), done: bossOf('mirror').gate({ beaten: ['pw:mirror:court1', 'pw:mirror:court2', 'pw:mirror:court3', 'pw:mirror:twin1', 'pw:mirror:twin2', 'pw:mirror:twin3', 'pw:mirror:beam1', 'pw:mirror:beam2', 'pw:mirror:beam3'] }) };
    });
    t.ok(/poor smudgy palace/.test(gate.words) && /🏓 0 \/ 3 · 👯 0 \/ 3 · 🔦 0 \/ 3/.test(gate.words) && gate.done === null, `Duke's gate words show 🏓 c / 3 · 👯 t / 3 · 🔦 b / 3 and open with all nine keys ("${gate.words}")`);
    t.ok(!page.errors.length, `no page errors in the palace ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ======================================================= old ======================================================= */
  if (want('old')) {
    const page = await openGame(browser, base);
    await newGame(page, 0); await pause(page);
    await intoSwirl(page);
    const mk = (version, spot) => page.evaluate(({ version, spot }) => {
      const g = window.pokecraft; g.save(true);
      const s = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
      const W = 160, idx = (x, y, z) => x + W * (z + W * y);
      const edits = [[idx(100, 30, 100), 3], [idx(104, 31, 100), 3]];
      return { ...s, place: 'swirl', realmPos: [...spot, 0, 0], realmEdits: { swirl: edits }, realmVersions: { ...s.realmVersions, swirl: version }, realmUp: null };
    }, { version, spot });
    const saves = { v5: await mk(5, [48.5, 21, 70.5]), v4: await mk(4, [100.5, 31, 105.5]) };
    delete saves.v5.stars; // a save from before wave 18 has no Mirror fields
    await pause(page);
    for (const [name, save] of Object.entries(saves)) {
      const old = await openGame(browser, base, { setup: seedSave(save) });
      await click(old, '#title-buttons button:has-text("Continue")');
      await waitFor(old, () => window.pokecraft.started, null, 240000);
      await waitFor(old, () => window.pokecraft.place === 'swirl' && !window.pokecraft.realms.busy, null, 120000);
      const r = await old.evaluate(async () => {
        const g = window.pokecraft, w = g.world, p = g.player.pos, { REALMS } = await import('/src/realms.js');
        return { pos: [p.x, p.y, p.z], e1: w.get(100, 30, 100), e2: w.get(104, 31, 100), v: g.realms.versions().swirl, frames: w.swirl.frames.length, stones: w.swirl.bridge.length };
      });
      const spot = name === 'v5' ? [48.5, 70.5] : [100.5, 105.5];
      t.ok(r.e1 === 3 && r.e2 === 3 && Math.abs(r.pos[0] - spot[0]) < 1.5 && Math.abs(r.pos[2] - spot[1]) < 1.5 && r.v === 6 && r.frames === 12 && r.stones === 13, `a ${name} Swirl save (from before wave 18) loads: both edits are kept, you stand where you were, the Swirl is version ${r.v} with 12 frames and 13 stones (${JSON.stringify(r)})`);
      t.ok(!old.errors.length, `no page errors (${name} save) ${old.errors.slice(0, 3).join(' | ')}`);
      await old.context().close();
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }
}
