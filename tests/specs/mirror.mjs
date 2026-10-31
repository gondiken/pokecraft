// Wave 18: the Mirror Palace (plans/wave18-mirror.md). STAGE 1 parts: swirl (the 13th frame S5, the 13 stones, the pinned island, the Swirl's
// version 6), removed (the owner's switch: REMOVED = ['mirror'] gives today's Swirl block for block, tests/fixtures/swirl-v5.json; no realm;
// the HUD says x / 12; the Book hides unseen creatures of the type; an old save with the Mirror's star, keys and wins loads in main and round-trips;
// un-removed it all comes back), closed (a covered secret frame without ?preview, open with it), land (mirrorcheck.mjs in Node for three seeds and
// the real realm in a browser: keeps, parts, the Boss, the crew, the guide), old (a save from before wave 18 loads, its Swirl edits kept).
// STAGE 3 parts: rules (the three games' pure rules in Node with the model players of tests/mirrorbots.mjs at 60 and 20 steps a second: naive fails, skilled wins, kind help,
// the rematch, for fun), kids (the real Player + MirrorLive in Node, tests/mirrornode.mjs: a skilled player with real keys wins the three twin rooms, the stances, Jump spam),
// play (the whole loop in a browser: the funny mirrors, the three games through the live part, keys saved, a reload, the crew, Duke Dazzle, the star, the rematch, for fun),
// real (real keys through the game's own loop), ipad, pair (two browsers: each plays their own game), shots (screenshots mirror-*.png).
// MIRROR_ONLY=swirl|removed|closed|land|rules|kids|play|real|ipad|pair|shots|old
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, seedSave, playBattle, continueGame } from '../helpers.mjs';
import { analyze } from '../mirrorcheck.mjs';
import * as ML from '../../src/mirrorland.js';
import * as BB from '../../src/bounceback.js';
import * as LG from '../../src/lookingglass.js';
import * as SL from '../../src/spotlight.js';
import * as KH from '../../src/kindhelp.js';
import { ForFun, FUN } from '../../src/forfun.js';
import { COURT_BOTS, TWIN_BOTS, SPOT_BOTS, playBounce, playTwin, playSpot, standInBeam, driveRoom } from '../mirrorbots.mjs';
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

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const frames = (page, n = 2) => page.evaluate(async n => {
  const g = window.pokecraft;
  for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); }
}, n);
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 120000 }); };
const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || !/Timeout/.test(e.message)) throw e; console.log('  (the page was slow to start: trying again)'); } } };
// A Champion in the Mirror Palace, through its frame in the Swirl.
async function intoMirror(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'mirror'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'mirror');
}
// The live part driven by hand (a manual clock), toasts collected, the model players of mirrorbots.mjs.
const arm = page => page.evaluate(async () => {
  const g = window.pokecraft, Bots = await import('/tests/mirrorbots.mjs'), MLm = await import('/src/mirrorland.js'), { B } = await import('/src/blocks.js');
  const live = g.gymLive.of('part:mirror');
  live.manual = true; live.playing = () => true;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
  const p = g.player;
  window.__R = {
    g, live, Bots, ML: MLm, B, p,
    said: re => window.__toasts.some(m => new RegExp(re).test(m)),
    put(x, y, z, yaw = 0) { p.carry = null; p.stepHook = null; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; p.yaw = yaw; p.pitch = 0; p.onGround = false; p.update(0.02); },
    // a whole Bounce-Back round through the live part with a model player (at most `secs` s of game time)
    court(bot = 'skilled', secs = 400, dt = 1 / 30) { const b = Bots.COURT_BOTS[bot](3); let n = 0; while (live.br && !live.br.done && n++ < secs / dt) live.step(dt, b(live.br, dt)); return live.info(); },
    courtIn: () => Bots.COURT_BOTS.skilled(3)(live.br, 1 / 30),
    // a whole Moonlit Gallery round
    beam(bot = 'skilled', secs = 60, dt = 1 / 30) { const b = Bots.SPOT_BOTS[bot](); let n = 0; while (live.sr && !live.sr.done && n++ < secs / dt) live.step(dt, b(live.sr, dt)); return live.info(); },
    boss: () => g.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'mirror'),
    crew: i => g.npcs.list.find(n => n.kind === 'crew' && n.def?.boss === 'mirror' && n.def.index === i),
  };
  return true;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
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
    t.ok(WOOL.mirror === 138 && BLOCKS[138].name === 'Mirror Wool' && B.MIRROR_PANE === 139 && pane.fixed && pane.name === 'Mirror' && pane.wallText && !(PLACEABLE ?? []).includes?.(139) && !Object.values(B).includes(137) && WOOL.custom === 137, 'block 138 is the mirror wool, 139 the mirror pane (fixed, not placeable); 137 is the Custom type\'s Canvas Wool (wave 19)');
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
    t.ok(r.wild === 7 && /Bounce-Back|Looking-Glass|Moonlit/.test(String(r.aim)), `the seven Mirror creatures live in the palace's spawn table; the guide: ${r.aim}`);
    // walk to the gate with the live physics off: the guide, the gate words from Duke
    const gate = await page.evaluate(async () => {
      const { bossOf } = await import('/src/pictureboss.js'), g = window.pokecraft;
      return { words: bossOf('mirror').gate(g), done: bossOf('mirror').gate({ beaten: ['pw:mirror:court1', 'pw:mirror:court2', 'pw:mirror:court3', 'pw:mirror:twin1', 'pw:mirror:twin2', 'pw:mirror:twin3', 'pw:mirror:beam1', 'pw:mirror:beam2', 'pw:mirror:beam3'] }) };
    });
    t.ok(/poor smudgy palace/.test(gate.words) && /🏓 0 \/ 3 · 👯 0 \/ 3 · 🔦 0 \/ 3/.test(gate.words) && gate.done === null, `Duke's gate words show 🏓 c / 3 · 👯 t / 3 · 🔦 b / 3 and open with all nine keys ("${gate.words}")`);
    t.ok(!page.errors.length, `no page errors in the palace ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ======================================================= rules (Node) ======================================================= */
  if (want('rules')) {
    // the kind help: one mapping, every lever within KIND_HELP.max, nothing before two misses
    const levers = ['ball', 'cleoReact', 'cleoSlide', 'mouth', 'balls', 'mop', 'pad', 'puddle', 'gloomy', 'hold', 'spot'];
    let maxLever = 0, early = 0;
    for (let m = 0; m <= 10; m++) for (const k of levers) { const d = Math.abs(BB.mirrorHelp(m)[k] - 1); maxLever = Math.max(maxLever, d); if (m < 2) early = Math.max(early, d); }
    t.ok(maxLever <= KH.KIND_HELP.max + 1e-9 && maxLever > 0.09 && early === 0 && LG.mirrorHelp === BB.mirrorHelp && SL.mirrorHelp === BB.mirrorHelp, `mirrorHelp is kindHelp mapped onto the levers: every one within ${KH.KIND_HELP.max * 100} % (${(maxLever * 100).toFixed(0)} % at most), nothing before two misses, the same function in all three games`);
    // Bounce-Back: the maths
    const n0 = BB.normalOf(0), d0 = BB.hitDir([0.3, -Math.sqrt(1 - 0.09)], 0), d20 = BB.hitDir([0, -1], BB.COURT_RULES.tiltMax / 2), dMax = BB.hitDir([0, -1], BB.COURT_RULES.tiltMax);
    t.ok(Math.abs(n0[1] - 1) < 1e-9 && Math.abs(d0[0] - 0.3) < 1e-9 && d0[1] > 0 && Math.abs(Math.asin(d20[0]) - BB.COURT_RULES.tiltMax) < 1e-6 && Math.abs(Math.asin(dMax[0]) - BB.COURT_RULES.outMax) < 1e-6, 'angle in = angle out: a flat mirror sends the ball straight back keeping its sideways way; a tilt of a turns it by 2a; never more than 70 degrees from straight (no endless side bounces)');
    const wc = BB.wallCross({ u: 8, v: 1.5, du: Math.sin(0.5), dv: Math.cos(0.5), s: 6 });
    t.ok(wc && wc.u >= 0.3 && wc.u <= 15.7 && wc.t > 4, `Cleo reads the ball's path with the side mirrors folded in (it crosses her line at u ${wc?.u.toFixed(1)} after ${wc?.t.toFixed(1)} s)`);
    // Cleo copies you
    const cr = new BB.BounceRound(7, 0, 0); cr.m = 3; for (let i = 0; i < 4 * 60; i++) cr.update(1 / 60, { slide: 0, tilt: 0 }); const cleoAt = cr.cu;
    t.ok(Math.abs(cleoAt - 3) < 0.1, `Cleo stands where you stand (you at u 3: Cleo at u ${cleoAt.toFixed(2)})`);
    // the round numbers, kind help and the rematch
    const r0 = new BB.BounceRound(7, 1, 0), r6 = new BB.BounceRound(7, 1, 0, { help: 6 }), rh = new BB.BounceRound(7, 1, 0, { hard: true });
    t.ok(r6.base < r0.base * 0.91 && r6.slide < r0.slide * 0.91 && r6.react < r0.react * 0.91 && r6.mouthHalf > r0.mouthHalf * 1.09 && Math.abs(rh.base - r0.base * 1.1) < 1e-9 && rh.react > r0.react + 0.19, `kind help after six misses: ball, Cleo's slide and reaction x0.9, the goal mouth x1.1; the rematch is harder (ball x1.1, reaction +0.2 s)`);
    // the same rally at 60 and 20 frames a second (the input is a function of time on a 0.05 s grid)
    const script = tt => { const g = Math.floor(tt * 20 + 1e-6) / 20; return { slide: Math.sin(g * 1.7), tilt: BB.COURT_RULES.tiltMax * Math.sin(g * 0.9) }; };
    const trace = fps => { const g = new BB.BounceRound(11, 0, 0); const ev = []; for (let i = 0; i < 40 * fps; i++) for (const e of g.update(1 / fps, script(i / fps))) ev.push(e.type + (e.who || '')); return { ev: ev.join(), you: g.you, cleo: g.cleo, m: +g.m.toFixed(3) }; };
    const a60 = trace(60), a20 = trace(20), a30 = trace(30);
    t.ok(a60.ev.length > 30 && a60.ev === a20.ev && a60.ev === a30.ev && a60.you === a20.you && a60.cleo === a20.cleo && a60.m === a20.m, `a rally with the same input plays the same at 60, 30 and 20 frames a second (${a60.ev.split(',').length} events)`);
    // the model players
    const wins = (bot, o, n = 12) => { let w = 0; for (let s = 1; s <= n; s++) if (playBounce(COURT_BOTS[bot](s), { seed: s, ...o }).won) w++; return w; };
    for (const fps of [60, 20]) {
      const sk = [0, 1, 2].map(round => wins('skilled', { round, fps }));
      const still = wins('still', { round: 0, fps }, 6), ft = wins('firstTime', { round: 0, fps }), rnd = wins('random', { round: 0, fps });
      t.ok(sk.every(w => w === 12) && still === 0 && ft >= 7 && rnd <= 1, `Bounce-Back at ${fps} fps: the skilled player wins all three rounds (${sk}/12); standing still with perfect sliding never wins round 1 (${still}/6), a first-timer who tilts a little half the time wins it (${ft}/12), random ${rnd}/12`);
    }
    const hardWin = wins('skilled', { round: 2, fps: 60, hard: true }, 8), helpWin = wins('skilled', { round: 2, fps: 60, help: 6 }, 8);
    t.ok(hardWin >= 7 && helpWin === 8, `the rematch (harder) and the kind help (easier) both still play for the skilled player (${hardWin}/8, ${helpWin}/8)`);
    // the Looking-Glass Rooms: the twin copies you mirrored, is stuck where you are not, hazards puff you both back
    const base0 = { n: 9, start: [10, 8], pads: [{ you: [10, 4], its: [10, 4] }], puddles: [], balls: [], mop: null, dressers: [] };
    const tr = new LG.TwinRoom(base0); tr.begin({ u: 10, v: 8 }); tr.tick(0.01, { u: 11, v: 9.5 }, 1, 1.5);
    t.ok(Math.abs(tr.twin.u - 11) < 1e-9 && Math.abs(tr.twin.v - 9.5) < 1e-9, 'the twin copies every step as a mirror image (you walk away from the glass, it walks away from the glass)');
    const tw = new LG.TwinRoom({ ...base0, dressers: [{ side: 'its', u: [0, 8], v: 5 }] }); tw.begin({ u: 4, v: 8 });
    const you = { u: 4, v: 8 }; for (let i = 0; i < 120; i++) { you.v -= 0.04; tw.tick(1 / 60, you, 0, -0.04); }
    t.ok(tw.twin.v >= 6.29 && tw.twin.v < 6.4 && you.v < 3.5, `a dresser on its side stops the twin while you walk on: you at v ${you.v.toFixed(1)}, the twin stuck at v ${tw.twin.v.toFixed(2)} (out of step)`);
    const hz = new LG.TwinRoom({ ...base0, puddles: [{ side: 'its', u: 10, v: 6, r: 1.2 }] }); hz.begin({ u: 10, v: 8 });
    let puffed = null; for (let i = 0; i < 90 && !puffed; i++) { const y = { u: 10, v: 8 - i * 0.04 }; puffed = hz.tick(1 / 60, y, 0, -0.04).find(e => e.type === 'puff'); }
    t.ok(puffed && puffed.why === 'plop' && puffed.side === 'its' && puffed.you.join() === '10,8' && puffed.its.join() === '10,8', 'the twin plops into an ink puddle on its side: both of you are puffed back to the last glowing pair (here the start)');
    const pd = new LG.TwinRoom(base0); pd.begin({ u: 10, v: 8 }); let glow = 0; for (let i = 0; i < 60; i++) { for (const e of pd.tick(1 / 60, { u: 10, v: 4 }, 0, i === 0 ? -4 : 0)) if (e.type === 'glow' || e.type === 'won') glow++; }
    t.ok(glow === 2 && pd.won, 'both of you on a pad pair for half a second makes it glow; all pairs glowing wins the room');
    for (const fps of [60, 20]) {
      const res = n => ['straight', 'random', 'watcher', 'skilled'].map(b => { let w = 0, miss = 0; for (let s = 1; s <= 6; s++) { const r = playTwin(TWIN_BOTS[b](s), n, { fps, phase: s * 1.37, budget: b === 'watcher' ? 240 : 90 }); w += r.won; miss += r.misses; } return { w, miss }; });
      const R1 = res(1), R2 = res(2), R3 = res(3);
      t.ok(R1[0].w === 0 && R2[0].w === 0 && R3[0].w === 0 && R1[1].w + R2[1].w + R3[1].w === 0 && R1[2].w === 6 && R2[2].w >= 4 && R3[2].w === 0 && R1[3].w === 6 && R2[3].w === 6 && R3[3].w === 6, `Looking-Glass Rooms at ${fps} fps: walking straight at the pads fails every room (puffed ${R1[0].miss + R2[0].miss + R3[0].miss} times), random walking too; a player who watches the glass wins rooms 1-2 (${R1[2].w}/6, ${R2[2].w}/6) but not room 3 (${R3[2].w}); the skilled one (the dresser, the gaps) wins all three (${R1[3].w + R2[3].w + R3[3].w}/18)`);
    }
    // the Moonlit Gallery: the beam, the shadows, the Gloomies
    const world = standInBeam(1), bw = SL.beamOf(world, 0, 0.1);
    t.ok(bw.spot && bw.spot.x > 70 && bw.spot.x < 90 && bw.hit.bounces === 0, `a straight look puts the spot on the Gloomy wall (${bw.spot?.x.toFixed(1)}, ${bw.spot?.y.toFixed(1)})`);
    const a = SL.aimAt(null, 72, 18, 58), banked = SL.beamOf(world, a.yaw, a.pitch);
    t.ok(banked.spot && banked.hit.bounces === 1 && Math.hypot(banked.spot.x - 72, banked.spot.y - 18) < 0.5, 'a look at the left side pane bounces the beam onto the wall (light bounces off shiny walls)');
    const behind = SL.aimAt(null, 67, 18), blocked = SL.beamOf(world, behind.yaw, behind.pitch);
    t.ok(!blocked.spot || Math.hypot(blocked.spot.x - 67, blocked.spot.y - 18) > 2, 'a straight beam at the wall behind a pillar is stopped by the pillar (a shadow)');
    const sr = new SL.SpotRound(3, 2, 0, { world }); let direct = 0, bank = 0;
    for (const sx of [66.5, 67.5, 92.5, 93.5]) for (const y of [14, 17, 20, 23, 25]) { const d = SL.aimAt(sr, sx, y), b = SL.beamOf(world, d.yaw, d.pitch); if (b.spot && Math.hypot(b.spot.x - sx, b.spot.y - y) < 0.6) direct++; if (sr.solve(sx, y)) bank++; }
    t.ok(direct === 0 && bank === 20, `nothing in the pillars' shadow strips can be lit by a straight beam (${direct} of 20 spots) but a banked one reaches all of them (${bank} of 20)`);
    for (const fps of [60, 20]) {
      const w = (bot, r, o = {}, n = 20) => { let c = 0; for (let s = 1; s <= n; s++) if (playSpot(SPOT_BOTS[bot](), { seed: s, round: r, fps, world, ...o }).won) c++; return c; };
      const sk = [0, 1, 2].map(r => w('skilled', r)), lag = [0, 1, 2].map(r => w('lagging', r)), sw = [0, 1, 2].map(r => w('sweeper', r, {}, 8)), st = w('still', 0, {}, 8);
      t.ok(sk.every(c => c === 20) && lag[0] >= 18 && lag[1] === 0 && lag[2] === 0 && sw.every(c => c === 0) && st === 0, `Moonlit Gallery at ${fps} fps: the skilled player wins every round (${sk}/20); aiming where a Gloomy WAS (0.4 s late, never banking) wins round 1 (${lag[0]}/20) but not 2 (${lag[1]}) or 3 (${lag[2]}); sweeping the light or standing still never wins`);
    }
    const sh = new SL.SpotRound(5, 1, 0, { help: 6, world }), s0 = new SL.SpotRound(5, 1, 0, { world }), shh = new SL.SpotRound(5, 1, 0, { hard: true, world });
    t.ok(sh.flee < s0.flee * 0.91 && sh.hold < s0.hold * 0.91 && sh.spotR > s0.spotR * 1.09 && shh.flee > s0.flee * 1.1 && shh.hold > s0.hold + 0.19, 'Gloomies: kind help after six misses (they run slower, need less light time, the spot is bigger); the rematch is harder (+12 % speed, +0.2 s)');
    const lw = new LG.TwinRoom(ML.TWIN_ROOMS[1], { help: 6 }), l0 = new LG.TwinRoom(ML.TWIN_ROOMS[1]);
    t.ok(lw.ballK < l0.ballK * 0.91 && lw.puddleK < 1 && lw.padR > l0.padR * 1.09, 'Looking-Glass Rooms: kind help makes the balls slower, the puddles smaller and the pads bigger');
    // for fun
    const ff = new ForFun(3); t.ok(ff.round(3) === 0 && (ff.won(0, 3), ff.round(3) === 1) && ff.round(1) === 1 && ff.tag(3) === ` ${FUN.tag}` && ff.tag(2) === '', 'every game plays its rounds again in turn once won (ForFun), and says so');
  }

  /* ======================================================= kids (Node, the real Player) ======================================================= */
  if (want('kids')) {
    const { mirrorEnv } = await import('../mirrornode.mjs');
    for (const dt of [1 / 60, 1 / 20]) {
      const fps = Math.round(1 / dt), e = await mirrorEnv(1);
      e.put(105.5, 11, 121.5, 0);
      const res = [1, 2, 3].map(n => driveRoom(e, n, { dt }));
      t.ok(res.every(r => r.won) && e.game.beaten.filter(k => /twin/.test(k)).length === 3 && res.every(r => r.t < 40), `the real Player at ${fps} fps: a skilled player, with real keys, wins the three Looking-Glass Rooms (${res.map(r => r.t + ' s').join(', ')}; keys saved, the doors open)`);
    }
    const e = await mirrorEnv(1), { player: p, live, step, world } = e;
    // a straight walker (real keys at the pads) fails room 1; jump spam changes nothing
    e.put(111.5, 11, 121.5, 0);
    for (let i = 0; i < 30; i++) step(1 / 60);
    let ok1 = false; for (const [u, v] of [[3, 4], [6, 12]]) ok1 = e.walkTo(128 - u, 118 + v, { max: 25 }) || ok1;
    t.ok(live.room && !live.room.won && live.room.misses >= 3, `the straight walker is puffed back again and again in room 1 (${live.room?.misses} times, ink puddles on the twin's way) and does not win`);
    e.put(111.5, 11, 121.5, 0); for (let i = 0; i < 30; i++) step(1 / 60);
    p.keys = { Space: true }; let t0 = 0; for (let i = 0; i < 60 * 15; i++) { p.joy = { x: 0, y: -1 }; p.yaw = Math.PI / 2 * 0 + 0.7; step(1 / 60); t0 += 1 / 60; } p.keys = {}; p.joy = null;
    t.ok(!live.room?.won && world.get(Math.floor(p.pos.x), 22, Math.floor(p.pos.z)) !== undefined && p.pos.y < 20, `holding Jump while walking solves nothing (no room won, still on the floor y ${p.pos.y.toFixed(1)})`);
    // the rail: the plate, Play!, the stick slides, the look tilts, Jump steps off
    e.put(27.5, 11, 119.8, 0);
    const w0 = live.near(p); live.use(p);
    t.ok(w0 === 'Play!' && p.carry === live.railObj && live.rail && live.br && live.near(p) === 'Stop' && p.carry.jumpWord() === 'Off', `the big button says Play! by the court, then you stand on the rail (Stop; Jump = Off)`);
    const m0 = live.railM; p.keys = { KeyD: true }; for (let i = 0; i < 30; i++) step(1 / 60); p.keys = {};
    const m1 = live.railM; p.keys = { KeyA: true }; for (let i = 0; i < 90; i++) step(1 / 60); p.keys = {};
    t.ok(m1 > m0 + 1.5 && live.railM < m1 - 3, `D slides your mirror along the rail to the right (${m0.toFixed(1)} to ${m1.toFixed(1)}), A back again (${live.railM.toFixed(1)})`);
    p.look(-1e5, 0); const yL = p.yaw; p.look(2e5, 0); const yR = p.yaw; p.look(0, 1e5); const pitch = p.pitch;
    step(1 / 60);
    t.ok(yL > 0.9 && yL <= 0.97 && yR < -0.9 && pitch >= -0.62 && Math.abs(live.br.tilt) <= 0.70, `your look turns the view within the court (yaw ${yL.toFixed(2)} / ${yR.toFixed(2)}) and tilts the mirror at most 40 degrees (tilt ${live.br.tilt.toFixed(2)})`);
    p.keys = {}; step(1 / 60); p.keys = { Space: true }; step(1 / 60); p.keys = {};
    t.ok(!p.carry && !live.rail && Math.hypot(p.pos.x - 27.5, p.pos.z - 119.5) < 3, 'Jump steps off the rail');
    // the sun mirror: Shine!, the look turns the beam, Jump steps off
    e.put(80.5, 11, 106.6, 0);
    const w1 = live.near(p); live.use(p); step(1 / 60);
    t.ok(w1 === 'Shine!' && p.carry === live.sunObj && live.shining && live.sr, 'by the dais the big button says Shine!, then you stand at the sun mirror');
    p.yaw = 0; p.pitch = 0.08; step(1 / 60); const s1 = live.sr.spot && { ...live.sr.spot }; p.look(-40, 0); step(1 / 60); const s2 = live.sr.spot && { ...live.sr.spot };
    t.ok(s1 && s2 && s2.x < s1.x - 1, `turning your look moves the spot of light on the wall (x ${s1?.x.toFixed(1)} to ${s2?.x.toFixed(1)})`);
    p.keys = {}; step(1 / 60); p.keys = { Space: true }; step(1 / 60); p.keys = {};
    t.ok(!p.carry && !live.shining, 'Jump steps off the dais');
    // the hook is only set while a room runs
    e.put(105.5, 11, 121.5, 0);
    t.ok(!live.info().hasHook && !p.stepHook, 'the player has no step hook outside a Looking-Glass Room (the jump spec stays bit for bit)');
  }

  /* ======================================================= play / shots (a browser) ======================================================= */
  if (want('play') || want('shots')) {
    const page = await retry(() => openGame(browser, base));
    await newGame(page, 0); await pause(page);
    await intoMirror(page);
    await arm(page);
    const D0 = await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R;
      live.step(0.05);
      return { place: g.place, parts: g.world.parts.map(x => x.id).join(), doors: live.info().doors.join(), chip: document.getElementById('score-chip')?.textContent, boss: !!R.boss(), crew: [0, 1, 2].map(i => R.crew(i)?.name).join(), aim: live.aim(p.pos)?.text('↑', 9) };
    });
    t.ok(D0.place === 'mirror' && D0.parts === 'mirror' && D0.boss && D0.crew === 'Copycat Cleo,Glazier Gwen,Lamplighter Lux' && /🏓 0 \/ 3 · 👯 0 \/ 3 · 🔦 0 \/ 3/.test(D0.chip) && D0.doors === 'false,false,false', `the frame opens the Mirror Palace; Duke Dazzle and his three helpers are there; the chip says ${D0.chip}; the three room doors are shut (${D0.doors})`);
    // the Hall of Funny Mirrors: a tall you, a wide you, only close to the glass
    const F0 = await page.evaluate(() => {
      const R = window.__R, { live, p } = R, out = {};
      R.put(64.5, 11, 119.5, 0); live.step(0.05); const tall = live.funny[0]; out.tall = tall.a.visible && tall.a.scale.y > 1.4 && tall.a.scale.x < 0.85;
      R.put(70.5, 11, 119.5, 0); live.step(0.05); const wide = live.funny[1]; out.wide = wide.a.visible && wide.a.scale.x > 1.5 && wide.a.scale.y < 0.8;
      R.put(89.5, 11, 119.5, 0); live.step(0.05); out.tiny = live.funny[2].a.visible && live.funny[2].a.scale.y < 0.5;
      R.put(93.5, 11, 128.5, Math.PI); live.step(0.05); out.twins = live.funny[5].a.visible && live.funny[5].b.visible && live.funny[5].a.position.x !== live.funny[5].b.position.x;
      R.put(66.5, 11, 128.5, Math.PI); live.step(0.05); out.upside = live.funny[4].a.visible && live.funny[4].a.scale.y < 0;
      R.put(95.5, 11, 119.5, 0); live.step(0.05); const w0 = live.funny[3].a.scale.x; live.clock += 0.5; live.step(0.01); out.wobble = Math.abs(live.funny[3].a.scale.x - w0) > 0.05;
      R.put(80.5, 11, 125.5, 0); live.step(0.05); out.far = live.info().funny.every(v => !v);
      return out;
    });
    t.ok(F0.tall && F0.wide && F0.tiny && F0.twins && F0.upside && F0.wobble && F0.far, `the funny mirrors show you tall, wide, tiny, upside down, two of you and wobbly, only close to the glass ${JSON.stringify(F0)}`);
    if (want('play')) {
      // Bounce-Back: Play!, a round lost by standing still ("Cleo won"), a round won by a skilled player, the key saved at once
      const C1 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, out = {};
        R.put(27.5, 11, 119.8); out.word = live.near(p); live.use(p); out.carry = p.carry === live.railObj; out.stop = live.near(p);
        out.said1 = R.said('First to 3'); out.still = R.court('still', 25); live.use(p); out.again = live.near(p); live.use(p);
        out.won = R.court('skilled'); out.key = g.beaten.includes('pw:mirror:court1'); out.saved = JSON.parse(localStorage.getItem('pokecraft-save-v2') ?? '{}').beaten?.includes('pw:mirror:court1') ?? false;
        out.cleoLine = R.said('Bounce it past Cleo');
        return out;
      });
      t.ok(C1.word === 'Play!' && C1.carry && C1.stop === 'Stop' && C1.said1 && C1.cleoLine && !C1.still.court.done && C1.again === 'Play!' && C1.won.court.done && C1.won.court.won && C1.key, `Bounce-Back: Play! puts you on the rail; standing still never gets anywhere (round not won after 25 s: ${C1.still.court.you} - ${C1.still.court.cleo}); a skilled player wins round 1 and the key is saved ${JSON.stringify([C1.key, C1.saved])}`);
      await page.evaluate(() => window.pokecraft.save(true));
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page);
      await placeIs(page, 'mirror'); await arm(page);
      const C2 = await page.evaluate(() => { const R = window.__R, { g, live, p } = R, out = { st: R.ML.mirrorState(g), place: g.place }; R.put(27.5, 11, 119.8); live.use(p); out.r2 = R.court('skilled'); live.use(p); out.r3 = R.court('skilled'); out.st2 = R.ML.mirrorState(g); live.step(0.1); out.chip = document.getElementById('score-chip')?.textContent; return out; });
      t.ok(C2.place === 'mirror' && C2.st.court === 1 && C2.r2.court.won && C2.r3.court.won && C2.st2.court === 3, `a reload keeps round 1 (🏓 ${C2.st.court} / 3) and you are still in the palace; rounds 2 and 3 are won (the spinner round too): 🏓 ${C2.st2.court} / 3`);
      // for fun: round 1 again, nothing new saved
      const F1 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, keys = g.beaten.slice().sort().join(), out = {};
        window.__toasts = []; live.leaveRail?.(); R.put(27.5, 11, 119.8); out.word = live.near(p); live.use(p); out.round = live.info().court.round; out.won = R.court('skilled'); out.fun = R.said('Just for fun!'); out.same = g.beaten.slice().sort().join() === keys;
        return out;
      });
      t.ok(F1.word === 'Play!' && F1.round === 0 && F1.won.court.won && F1.fun && F1.same, 'Bounce-Back won: the plate plays the rounds again just for fun, nothing new saved');
      // the Looking-Glass Rooms through the real Player and the game's own world and doors
      const T1 = await page.evaluate(async () => {
        const R = window.__R, { g, live, p } = R, out = {};
        live.giveBack(); R.put(105.5, 11, 121.5);
        const env = { player: p, live, step: dt => { p.update(dt); live.step(dt); } };
        out.r1 = R.Bots.driveRoom(env, 1); out.k1 = g.beaten.includes('pw:mirror:twin1'); live.step(0.3);
        out.door1 = live.L.doors[0].yours.every(c => g.world.get(...c) === R.B.AIR) && live.L.doors[0].its.every(c => g.world.get(...c) === R.B.AIR);
        out.door2 = live.L.doors[1].yours.every(c => g.world.get(...c) === R.B.PLANKS);
        out.r2 = R.Bots.driveRoom(env, 2); out.r3 = R.Bots.driveRoom(env, 3); live.step(0.3);
        out.st = R.ML.mirrorState(g); out.said = R.said('The Looking-Glass Rooms are won');
        return out;
      });
      t.ok(T1.r1.won && T1.k1 && T1.door1 && T1.door2 && T1.r2.won && T1.r3.won && T1.st.twin === 3 && T1.said, `the Looking-Glass Rooms: the twin copies a skilled player through all three rooms in the game's own world; each win is saved and opens its doors (${JSON.stringify([T1.r1.t, T1.r2.t, T1.r3.t])} s)`);
      // the Moonlit Gallery with the game's own world (pillars, panes)
      const B1 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, out = {};
        live.giveBack(); R.put(80.5, 11, 106.6); out.word = live.near(p); live.use(p); out.carry = p.carry === live.sunObj;
        out.still = R.beam('still', 6); live.use(p); out.again = live.near(p); live.use(p);
        out.r1 = R.beam('skilled'); live.use(p); out.r2 = R.beam('skilled'); live.use(p); out.r3 = R.beam('skilled'); live.step(0.1);
        out.st = R.ML.mirrorState(g); out.chip = document.getElementById('score-chip')?.textContent; out.said = R.said('No more Gloomies');
        return out;
      });
      t.ok(B1.word === 'Shine!' && B1.carry && !B1.still.beam.done && B1.again === 'Shine!' && B1.r1.beam.won && B1.r2.beam.won && B1.r3.beam.won && B1.st.beam === 3 && B1.st.done && /🔦 3 \/ 3/.test(B1.chip), `the Moonlit Gallery: Shine! at the dais; holding the light still pops nothing; a skilled player wins the three rounds (banking off a side pane for the shaded ones); with all nine keys the chip says "${B1.chip}" (the Hall opens once the helpers are beaten)`);
      // the helpers, the Boss: crew first, a lost battle stays, the star clears the nine keys, the rematch is harder
      const K1 = await page.evaluate(async () => {
        const R = window.__R, { g } = R, Sp = await import('/src/species.js'), { bossOf } = await import('/src/pictureboss.js'), out = {};
        R.live.giveBack(); R.put(80.5, 12, 30.5); // (a kid steps off the dais and walks to the Grand Mirror Hall)
        g.beaten = g.beaten.filter(k => !/pw:mirror:crew/.test(k));
        out.gate = bossOf('mirror').gate(g); g.talkTo(R.boss()); out.crewFirst = !g.inBattle && R.said('first');
        g.party = [Sp.makeCreature('thunderwolf', 100)]; g.talkTo(R.crew(0));
        return out;
      });
      t.ok(K1.gate === null && K1.crewFirst, "with all nine keys Duke Dazzle's gate is open, but his helpers come first");
      t.ok(await playBattle(page), "Copycat Cleo's battle is won");
      await page.evaluate(() => { const R = window.__R; R.g.talkTo(R.crew(1)); });
      t.ok(await playBattle(page), "Glazier Gwen's battle is won");
      await page.evaluate(() => { const R = window.__R; R.g.talkTo(R.crew(2)); });
      t.ok(await playBattle(page), "Lamplighter Lux's battle is won");
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('fluffin', 2)]; const b = R.boss(); g.player.pos.set(b.pos.x, b.pos.y, b.pos.z + 2.5); g.talkTo(b); });
      t.ok(await playBattle(page), 'a weak team loses the Boss battle');
      const L1 = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, b = g.world.bosses[0]; return { place: g.place, d: Math.hypot(p.x - b.rest[0], p.z - b.rest[2]), star: g.stars.includes('mirror') }; });
      t.ok(L1.place === 'mirror' && L1.d < 2.5 && !L1.star, `losing keeps you in the Grand Mirror Hall (${L1.d.toFixed(1)} from the rest spot)`);
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('thunderwolf', 100)]; g.talkTo(R.boss()); });
      t.ok(await playBattle(page), 'the Boss battle is won');
      const W1 = await page.evaluate(() => {
        const R = window.__R, { g, live } = R; live.step(0.3); g.ui.renderHud?.();
        return { star: g.stars.includes('mirror'), keys: g.beaten.filter(k => /pw:mirror:(court|twin|beam)/.test(k)).length, crew: g.beaten.filter(k => /pw:mirror:crew/.test(k)).length, hud: g.ui.starsShown, doors: live.info().doors.join(), hard: live.hard };
      });
      t.ok(W1.star && W1.keys === 0 && W1.crew === 3 && W1.hud === '1/13' && W1.doors === 'true,true,true' && W1.hard, `the star (the HUD says ${W1.hud}); the nine round keys are cleared for a rematch (the helpers stay beaten, the doors stay open for the star holder)`);
      // the rematch plays the games again, harder
      const H1 = await page.evaluate(() => { const R = window.__R, { live, p } = R; live.giveBack(); R.put(27.5, 11, 119.8); live.use(p); const hard = live.br.base; const out = { hard, hardRound: live.br.hard, won: R.court('skilled').court.won }; live.giveBack(); return out; });
      t.ok(H1.hardRound && Math.abs(H1.hard - 6.0 * 1.1) < 1e-9 && H1.won, `the rematch plays Bounce-Back again, harder (ball ${H1.hard.toFixed(2)} instead of 6.0), and a skilled player still wins`);
      // a save with all nine rounds and the star: the games still start, just for fun
      await page.evaluate(() => { const R = window.__R; R.live.winUpTo(3, 3, 3); window.pokecraft.save(true); });
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page);
      await placeIs(page, 'mirror'); await arm(page);
      const RL = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, out = { st: R.ML.mirrorState(g) };
        R.put(27.5, 11, 119.8); out.court = live.near(p); live.use(p); out.cround = live.info().court.round; live.giveBack();
        R.put(80.5, 11, 106.6); out.beam = live.near(p); live.use(p); out.bround = live.info().beam.round; live.giveBack();
        return out;
      });
      t.ok(RL.st.done && RL.st.star && RL.court === 'Play!' && RL.cround === 0 && RL.beam === 'Shine!' && RL.bround === 0, 'after a reload with every round won and the star, Play! and Shine! still start round 1, just for fun');
      t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
    }
    if (want('shots') || !ONLY) {
      const look = (x, y, z, tx, ty, tz) => page.evaluate(([x, y, z, tx, ty, tz]) => { const R = window.__R, { live, p } = R; R.put(x, y, z); p.lookAt({ x: tx, y: ty, z: tz }); live.step(0.05); }, [x, y, z, tx, ty, tz]);
      await page.evaluate(() => { const R = window.__R, { g, live } = R; live.giveBack(); g.beaten = g.beaten.filter(k => !/pw:mirror:(court|twin|beam)/.test(k)); live.sync(true); });
      await look(64.5, 11, 119.5, 64.5, 13.5, 114); await frames(page, 3); await shot(page, 'mirror-funny-tall.png');
      await look(70.5, 11, 119.5, 70.5, 13.5, 114); await frames(page, 3); await shot(page, 'mirror-funny-wide.png');
      await look(93.5, 11, 128.5, 93.5, 13.5, 134); await frames(page, 3); await shot(page, 'mirror-funny-twins.png');
      await look(80.5, 11, 128, 80.5, 14, 114); await frames(page, 3); await shot(page, 'mirror-hall.png');
      // Bounce-Back mid-rally: Cleo, the ball, the hand mirror in front of you
      await page.evaluate(() => { const R = window.__R, { live, p } = R; R.put(27.5, 11, 119.8); live.use(p); for (let i = 0; i < 60; i++) live.step(1 / 30, R.courtIn()); p.yaw = -0.05; p.pitch = -0.22; live.step(1 / 30, R.courtIn()); });
      await frames(page, 3); await shot(page, 'mirror-court.png');
      await page.evaluate(() => { const R = window.__R, { live, p } = R; for (let i = 0; i < 70 && !(live.br.ball && live.br.ball.v > 12 && live.br.ball.dv > 0); i++) live.step(1 / 30, R.courtIn()); p.yaw = 0.2; p.pitch = -0.3; live.step(1 / 30, R.courtIn()); });
      await frames(page, 3); await shot(page, 'mirror-court-ball.png');
      // the twin: room 2 (bonk balls) and room 3 (the dresser), looking through the glass
      await page.evaluate(() => { const R = window.__R, { g, live, p } = R; live.giveBack(); g.beaten.push('pw:mirror:twin1', 'pw:mirror:twin2'); live.sync(true); R.put(113, 11, 100 + 14.2, -Math.PI / 2); for (let i = 0; i < 12; i++) { p.update(1 / 30); live.step(1 / 30); } p.yaw = -Math.PI / 2 + 0.35; p.pitch = -0.28; live.step(1 / 30); });
      await frames(page, 3); await shot(page, 'mirror-twin.png');
      await page.evaluate(() => { const R = window.__R, { live, p } = R; live.giveBack(); R.put(113, 11, 82 + 14.2, -Math.PI / 2); for (let i = 0; i < 12; i++) { p.update(1 / 30); live.step(1 / 30); } p.yaw = -Math.PI / 2 + 0.15; p.pitch = -0.4; live.step(1 / 30); });
      await frames(page, 3); await shot(page, 'mirror-twin3.png');
      // the gallery: the Gloomies on the wall, the spot of light, the beam (a banked one too)
      await page.evaluate(() => { const R = window.__R, { g, live, p } = R; live.giveBack(); g.beaten = g.beaten.filter(k => !/beam/.test(k)); live.sync(true); R.put(80.5, 11, 106.6); live.use(p); const b = R.Bots.SPOT_BOTS.skilled(); for (let i = 0; i < 20; i++) live.step(1 / 30, b(live.sr, 1 / 30)); const t = live.sr.target(0.03); p.yaw = t.yaw; p.pitch = t.pitch; live.step(1 / 30, { yaw: t.yaw, pitch: t.pitch }); });
      await frames(page, 3); await shot(page, 'mirror-gallery.png');
      await page.evaluate(() => { const R = window.__R, { g, live, p } = R; live.giveBack(); g.beaten = g.beaten.filter(k => !/beam/.test(k)); R.put(80.5, 11, 106.6); live.use(p); p.yaw = 0.05; p.pitch = 0.1; live.step(1 / 30, { yaw: 0.05, pitch: 0.1 }); });
      await frames(page, 3); await shot(page, 'mirror-gallery-aim.png');
      await page.evaluate(() => { const R = window.__R, { g, live, p } = R; live.giveBack(); R.put(80.5, 11, 106.6); live.use(p); const y = p.yaw = 0.58, a = R.Bots.SPOT_BOTS; p.pitch = 0.02; live.step(1 / 30, { yaw: y, pitch: 0.02 }); });
      await frames(page, 3); await shot(page, 'mirror-gallery-bank.png');
      await page.evaluate(() => { const R = window.__R, { g, live, p } = R; live.giveBack(); const b = g.world.bosses[0]; R.put(b.rest[0], b.rest[1], b.rest[2] + 3); p.lookAt({ x: b.pos[0], y: b.pos[1] + 1.4, z: b.pos[2] }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'mirror-duke.png');
    }
    await page.context().close();
  }

  /* ======================================================= real (keys through the game's own loop) ======================================================= */
  if (want('real')) {
    const fakeLock = () => {
      Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get() { return window.__lock ? document.getElementById('game') : null; } });
      const change = on => { window.__lock = on; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); };
      HTMLCanvasElement.prototype.requestPointerLock = function () { change(true); return Promise.resolve(); };
      Document.prototype.exitPointerLock = function () { change(false); };
    };
    // the game clock: summed frame dt of the live part (waits are in game seconds, whatever the frame rate)
    const clockOn = pg => pg.evaluate(() => { const g = window.pokecraft, gl = g.gymLive, up = gl.update.bind(gl); window.__T = 0; gl.update = dt => { up(dt); window.__T += dt; }; });
    const waitT = (pg, s) => pg.evaluate(s => new Promise(r => { const t0 = window.__T, w0 = Date.now(); const f = () => (window.__T - t0 >= s || Date.now() - w0 > 120000 ? r() : requestAnimationFrame(f)); f(); }), s);
    const look = (pg, dx, dy = 0) => pg.evaluate(([dx, dy]) => { document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy })); return window.pokecraft.player.yaw; }, [dx, dy]);
    const key = async (pg, k, s = 0) => { await pg.keyboard.down(k); if (s) await waitT(pg, s); await pg.keyboard.up(k); };
    const at = (pg, x, y, z, yaw = 0) => pg.evaluate(([x, y, z, yaw]) => { const g = window.pokecraft, p = g.player, l = g.gymLive.of('part:mirror'); l.giveBack(); p.carry = null; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0; p.keys = {}; }, [x, y, z, yaw]);
    const page = await retry(() => openGame(browser, base, { setup: ctx => ctx.addInitScript(fakeLock) }));
    await newGame(page, 0);
    await page.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoMirror(page);
    await page.evaluate(() => document.getElementById('game').requestPointerLock());
    await waitFor(page, () => !!document.pointerLockElement && window.pokecraft.started && document.getElementById('pause').classList.contains('hidden'), null, 20000);
    await clockOn(page);
    // E at the plate (the game's own action path) starts Bounce-Back; D slides the rail; the mouse tilts the mirror; Space steps off
    await at(page, 27.5, 11, 119.8); await waitT(page, 0.3);
    await key(page, 'KeyE');
    await waitFor(page, () => window.pokecraft.gymLive.of('part:mirror').rail, null, 60000);
    await waitT(page, 0.2);
    const m0 = await page.evaluate(() => window.pokecraft.gymLive.of('part:mirror').railM);
    await key(page, 'KeyD', 0.5);
    await look(page, -250, 0); await waitT(page, 0.2);
    const R1 = await page.evaluate(() => { const l = window.pokecraft.gymLive.of('part:mirror'); return { m: l.railM, tilt: l.br?.tilt ?? 0, running: !!l.br, yaw: window.pokecraft.player.yaw }; });
    t.ok(R1.m > m0 + 1.5 && R1.running && R1.tilt < -0.3 && R1.yaw > 0.3, `real keys and mouse: E at the plate starts the round, D slides the mirror (${m0.toFixed(1)} to ${R1.m.toFixed(1)}), the mouse tilts it (${R1.tilt.toFixed(2)} rad)`);
    await key(page, 'Space', 0.1);
    await waitFor(page, () => !window.pokecraft.gymLive.of('part:mirror').rail, null, 60000);
    t.ok(true, 'real keys: Space steps off the rail');
    // walk into room 1 with W: the room starts on the pad and the twin copies the real walk
    await at(page, 108.5, 11, 121.5, -Math.PI / 2); await waitT(page, 0.3);
    await page.keyboard.down('KeyW');
    await waitFor(page, () => !!window.pokecraft.gymLive.of('part:mirror').room, null, 120000);
    await waitT(page, 0.5); await page.keyboard.up('KeyW');
    const T = await page.evaluate(() => { const live = window.pokecraft.gymLive.of('part:mirror'), i = live.info(), p = window.pokecraft.player.pos; return { hook: i.hasHook, room: i.room, twinX: live.twin.position.x, twinZ: live.twin.position.z, x: p.x, z: p.z, vis: live.twin.visible }; });
    t.ok(T.hook && T.room?.n === 1 && T.vis && Math.abs(T.twinX - (257 - T.x)) < 0.4 && Math.abs(T.twinZ - T.z) < 0.4, `real keys: walking onto the start pad starts the room, and the twin copies the real walk as a mirror image (you x ${T.x.toFixed(2)}, the twin x ${T.twinX.toFixed(2)})`);
    // E at the dais starts Shine!, the mouse look moves the spot
    await at(page, 80.5, 11, 106.6); await waitT(page, 0.3);
    await key(page, 'KeyE');
    await waitFor(page, () => window.pokecraft.gymLive.of('part:mirror').shining, null, 60000);
    await page.evaluate(() => { const p = window.pokecraft.player; p.yaw = 0; p.pitch = 0.08; });
    await waitT(page, 0.3);
    const s1 = await page.evaluate(() => window.pokecraft.gymLive.of('part:mirror').info().beam?.spot?.x);
    await look(page, -40, 0); await waitT(page, 0.3);
    const s2 = await page.evaluate(() => window.pokecraft.gymLive.of('part:mirror').info().beam?.spot?.x);
    t.ok(s1 != null && s2 != null && s2 < s1 - 1, `real keys and mouse: E at the dais starts Shine!, the mouse moves the spot of light (x ${s1?.toFixed(1)} to ${s2?.toFixed(1)})`);
    t.ok(!page.errors.length, `no page errors (real) ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ======================================================= ipad ======================================================= */
  if (want('ipad')) {
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoMirror(ip);
    await arm(ip);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    await ip.evaluate(() => { const R = window.__R; R.put(27.5, 11, 119.8); R.live.step(0.03); });
    await frames(ip, 2);
    const w1 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act');
    await waitFor(ip, () => window.__R.live.rail, null, 30000);
    await frames(ip, 2);
    const I1 = await ip.evaluate(() => {
      const R = window.__R, { g, live, p } = R, out = { act: document.getElementById('btn-act')?.textContent.trim(), jump: document.getElementById('btn-jump')?.textContent.trim() }, m0 = live.railM;
      p.yaw = 0; g.touch.joy = { x: 1, y: 0 }; p.joy = g.touch.joy; for (let i = 0; i < 12; i++) { p.update(1 / 30); live.step(1 / 30); }
      g.touch.joy = null; p.joy = null; out.slid = live.railM - m0;
      p.look(-200, 0); live.step(1 / 30); out.yaw = p.yaw; out.tilt = live.br.tilt; // a drag tilts the mirror
      return out;
    });
    t.ok(w1 === 'Play!' && I1.act === 'Stop' && I1.jump === 'Off' && I1.slid > 1 && I1.yaw > 0.3 && Math.abs(I1.tilt) > 0.2, `iPad: Play! then Stop on the big button, the Jump button says Off; the stick slides the mirror (${I1.slid.toFixed(1)}), a drag tilts it (tilt ${I1.tilt.toFixed(2)})`);
    await ip.evaluate(() => { const R = window.__R; R.live.giveBack(); R.put(80.5, 11, 106.6); R.live.step(0.03); });
    await frames(ip, 2);
    const w2 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act');
    await waitFor(ip, () => window.__R.live.shining, null, 30000);
    await frames(ip, 2);
    const I2 = await ip.evaluate(() => {
      const R = window.__R, { g, live, p } = R, out = { act: document.getElementById('btn-act')?.textContent.trim(), jump: document.getElementById('btn-jump')?.textContent.trim() };
      p.yaw = 0; p.pitch = 0.05; const y0 = p.yaw; g.touch.joy = { x: -1, y: 0 }; p.joy = g.touch.joy; for (let i = 0; i < 6; i++) { p.update(1 / 30); live.step(1 / 30); }
      g.touch.joy = null; p.joy = null; out.turned = p.yaw - y0; // the stick turns the beam too
      return out;
    });
    t.ok(w2 === 'Shine!' && I2.act === 'Stop' && I2.jump === 'Off' && Math.abs(I2.turned) > 0.1, `iPad: Shine! then Stop, the Jump button says Off, the stick turns the sun mirror (${I2.turned.toFixed(2)} rad)`);
    const after = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    t.ok(after === before, `no touch button came or went (${before})`);
    await ip.evaluate(() => { const R = window.__R, { live, p } = R; live.giveBack(); R.put(105.5, 11, 121.5, -Math.PI / 2); for (let i = 0; i < 4; i++) { p.update(1 / 30); live.step(1 / 30); } });
    await shot(ip, 'mirror-ipad.png').catch(() => {});
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  /* ======================================================= pair ======================================================= */
  if (want('pair')) {
    const [A, Bp] = await retry(() => openPair(browser, base));
    await newGame(A, 0); await pause(A);
    await newGame(Bp, 1); await pause(Bp);
    await A.fill('#mp input[placeholder="Your name"]', 'Dad');
    await click(A, '#mp button:has-text("Share my world")');
    await A.waitForTimeout(500);
    const code = (await A.textContent('.mp-code')).trim();
    await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
    await Bp.fill('#mp .mp-code-input', code);
    await click(Bp, '#mp button:has-text("Join a world")');
    await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000); console.log('  pair: Kid joined');
    for (const P of [A, Bp]) await P.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'swirl');
    const cell = await A.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'mirror'), p = g.player; p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 }); return f.cloth[Math.floor(f.cloth.length / 2)]; });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'mirror');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'mirror'); console.log('  pair: both in the Mirror Palace');
    await arm(A); await arm(Bp);
    // Dad plays Bounce-Back and wins a round; the Kid plays the gallery: each plays their own game, nothing is shared
    await A.evaluate(() => { const R = window.__R; R.put(27.5, 11, 119.8); R.live.use(R.p); R.court('skilled'); window.pokecraft.mp.sendState(); });
    await Bp.evaluate(() => { const R = window.__R; R.put(80.5, 11, 106.6); R.live.use(R.p); window.pokecraft.mp.sendState(); });
    await A.waitForTimeout(1500);
    const a1 = await A.evaluate(() => { const R = window.__R, { g, live } = R; return { mine: R.ML.mirrorState(g), court: live.info().court?.done, other: [...g.mp.others.values()][0] ? { here: [...g.mp.others.values()][0].here } : null, beam: live.info().beam }; });
    const b1 = await Bp.evaluate(() => { const R = window.__R, { g, live } = R; return { mine: R.ML.mirrorState(g), court: live.info().court, beam: !!live.info().beam, others: [...g.mp.others.values()].map(o => ({ x: o.targetPos?.x ?? o.pos?.x ?? null, z: o.targetPos?.z ?? o.pos?.z ?? null })) }; });
    t.ok(a1.mine.court === 1 && a1.court && a1.beam === null && b1.mine.court === 0 && b1.court === null && b1.beam, `each plays their own game: Dad's Bounce-Back round is won on his side only (🏓 ${a1.mine.court} / 3 for Dad, ${b1.mine.court} / 3 for the Kid); the Kid's court, Cleo and ball do not exist for him, Dad has no Gloomies`);
    t.ok(b1.others.length === 1 && b1.others[0].z != null, `the Kid still sees Dad's avatar (${JSON.stringify(b1.others[0])}); the games themselves are never sent`);
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors in the pair ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
    await A.context().close(); await Bp.context().close();
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
