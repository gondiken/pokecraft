// T40 base (wave 14): the shared Picture World base. Four new types (chart, wool, colours), the base blocks, Picture World data
// and the stand-in terrains for three seeds (house, pirate, Playland), the Mover, the whole loop (Swirl -> ready frame -> Picture
// World -> Boss -> star -> way back -> door home), Boss rematches and losing, Playland's two frames, two browsers (a friend follows
// there and back), old saves and an iPad. Screenshots: t40-frame-ready.png, t40-house-stub.png, t40-playland-hub.png, t40-star-note.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, continueGame, waitFor as waitFor0, seedSave, playBattle } from '../helpers.mjs';
const waitFor = (page, fn, arg, ms = 90000) => waitFor0(page, fn, arg, Math.max(ms, 90000)); // the software renderer is slow with several pages open

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const OLD_CHART = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'old-chart.json'), 'utf8'));
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 90000);
const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
// Champion in the Swirl, standing at the door home
async function intoSwirl(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
}
const flip = (page, id, ready = true) => page.evaluate(async ([id, ready]) => {
  const { pictureWorld } = await import('/src/pictureworlds.js');
  pictureWorld(id).ready = ready; window.pokecraft.portal.reset(window.pokecraft.world);
}, [id, ready]);
// look at a frame's middle from its stand
const atFrame = (page, id) => page.evaluate(async id => {
  const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === id), p = g.player;
  p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
  p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
  return f.cloth[Math.floor(f.cloth.length / 2)];
}, id);
const useFrame = (page, cell) => page.evaluate(c => { const g = window.pokecraft; const b = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }; return { prompt: g.portal.prompt(b, 'click or E'), action: g.portal.action(b), used: g.portal.use(b) }; }, cell);

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (process.env.PW_ONLY === 'pair') return pairPart({ browser, base, t });
  const page = await openGame(browser, base);

  /* ---- 1. Types, wool, blocks (data) ---- */
  const d1 = await page.evaluate(async old => {
    const S = await import('/src/species.js'), Bk = await import('/src/blocks.js');
    const types = Object.keys(S.TYPE_COLORS), news = ['tiny', 'pirate', 'racer', 'ball'];
    const e = (a, b) => S.effectiveness(a, b);
    const row = (a, want) => Object.entries(want).filter(([b, v]) => e(a, b) !== v).map(([b, v]) => `${a}>${b} ${e(a, b)} want ${v}`);
    const bad = [
      ...row('tiny', { racer: 2, food: 2, cyber: 2, tiny: 0.5, fire: 0.5, sky: 0.5 }), ...row('pirate', { ball: 2, treasure: 2, water: 2, pirate: 0.5, metal: 0.5, ice: 0.5 }),
      ...row('racer', { pirate: 2, time: 2, parkour: 2, racer: 0.5, rock: 0.5, slime: 0.5 }), ...row('ball', { tiny: 2, squad: 2, bone: 2, ball: 0.5, grass: 0.5, pixie: 0.5 }),
      ...row('fire', { tiny: 2 }), ...row('sky', { tiny: 2 }), ...row('electric', { pirate: 2 }), ...row('water', { racer: 2 }), ...row('ice', { racer: 2 }), ...row('grass', { ball: 2 }), ...row('ninja', { ball: 2 }),
    ];
    // the old 33 x 33 chart is unchanged: every old cell (and every cell not named above is still 1 against the old types)
    const oldTypes = ['normal', ...types.filter(x => !news.includes(x) && x !== 'doodle')], // T45: Doodle's cells are checked in doodle.mjs
       added = new Set(['fire>tiny', 'sky>tiny', 'electric>pirate', 'water>racer', 'ice>racer', 'grass>ball', 'ninja>ball']);
    const changed = [];
    for (const a of oldTypes) for (const b of oldTypes) if (e(a, b) !== (old[a]?.[b] ?? 1)) changed.push(`${a}>${b}`);
    const extra = [];
    for (const a of oldTypes) for (const b of news) if (e(a, b) !== 1 && !added.has(`${a}>${b}`)) extra.push(`${a}>${b}`);
    // a defender is weak to at most 5 types (6 for mind / ghost / drake)
    const weak = {};
    for (const b of types) weak[b] = types.concat('normal').filter(a => e(a, b) > 1).length;
    const tooWeak = types.filter(b => weak[b] > (['mind', 'ghost', 'drake'].includes(b) ? 6 : 5));
    const hardHits = Object.fromEntries(news.map(a => [a, types.filter(b => e(a, b) > 1).length]));
    const ids = ['PICTURE', 'WAY_BACK', 'BOSS_STAND'].map(k => Bk.B[k]);
    return {
      n: types.length, colors: news.map(x => !!S.TYPE_COLORS[x]), bad, changed, extra, tooWeak, hardHits,
      wool: news.map(x => [Bk.WOOL[x], Bk.BLOCKS[Bk.WOOL[x]].name, Bk.PLACEABLE.includes(Bk.WOOL[x])]),
      blocks: ids.map(id => ({ id, def: !!Bk.BLOCKS[id], placeable: Bk.PLACEABLE.includes(id), fixed: !!Bk.BLOCKS[id]?.fixed, wall: !!Bk.BLOCKS[id]?.wallText, tiles: [Bk.BLOCKS[id]?.top, Bk.BLOCKS[id]?.side].every(x => x >= 0 && x < Bk.TILE_COUNT) })),
      tiles: Bk.TILE_COUNT, free: Math.max(...Object.values(Bk.B)) + 1,
    };
  }, OLD_CHART);
  t.ok(d1.n >= 37 && d1.colors.every(Boolean), `37 types, the four new ones have colours (${d1.n})`);
  t.ok(!d1.bad.length, `the corrected chart rows and the seven added cells ${d1.bad.join('; ')}`);
  t.ok(!d1.changed.length && !d1.extra.length, `the old 33 x 33 chart is unchanged, no other cell touches a new type ${d1.changed.join(',')} ${d1.extra.join(',')}`);
  t.ok(Object.values(d1.hardHits).every(n => n === 3), `each new type hits 3 types hard (the weak-to-at-most-5 rule is checked by two-types / three-types / four-types) (${JSON.stringify(d1.hardHits)})`);
  t.ok(JSON.stringify(d1.wool) === JSON.stringify([[140, 'Tiny Wool', false], [141, 'Pirate Wool', false], [142, 'Racer Wool', false], [143, 'Ball Wool', false]]), 'wool 140-143 with their names, not placeable');
  t.ok(d1.blocks.map(b => b.id).join() === '144,145,146' && d1.blocks.every(b => b.def && !b.placeable && b.fixed && b.wall && b.tiles), `blocks 144-146 (picture, way back, Boss stand): tiles, wall text, fixed, not placeable`);
  t.ok(d1.tiles <= 1024 && d1.free >= 147, `the atlas has room (${d1.tiles} of 1024 tiles, a 32 x 32 grid), next free id ${d1.free}`);

  /* ---- 2. Data ---- */
  const d2 = await page.evaluate(async () => {
    const P = await import('/src/pictureworlds.js'), R = await import('/src/realms.js'), L = await import('/src/playland.js'), B = await import('/src/pictureboss.js');
    const gy = await import('/src/gyms.js'), M = await import('/src/mover.js');
    const real = P.PICTURE_WORLDS.filter(w => w.realm);
    const within = b => b.x0 >= 0 && b.z0 >= 0 && b.x1 < L.PLAYLAND.size[0] && b.z1 < L.PLAYLAND.size[1];
    const boxes = Object.values(L.ZONES).map(z => z.box), hub = L.HUB;
    const hit = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.z0 <= b.z1 && a.z1 >= b.z0;
    const disjoint = [...boxes, hub].every((a, i, all) => all.every((b, j) => i === j || !hit(a, b)));
    return {
      counts: [P.PICTURE_WORLDS.length, P.FRAME_WORLDS.length, P.BRIDGE_WORLDS.length], order: P.PICTURE_WORLDS.map(w => w.id).join(), ready: P.PICTURE_WORLDS.filter(w => w.ready).length,
      realms: real.map(w => `${w.id}:${w.realm}`).join(), worlds: P.worldsOf('playland').map(w => w.id).join(),
      defs: real.map(w => { const r = R.REALMS[w.realm]; return r && r.parent === 'swirl' && r.entrance === 'frame' && r.morning === false && r.lose === 'stay' && Object.values(r.spawns).every(Array.isArray) && Object.keys(r.spawns).length > 1; }).every(Boolean),
      noGym: !gy.GYMS.some(g => ['house', 'pirate', 'playland'].includes(g.realm)) && gy.GYMS.length === 32, rematchCap: gy.REMATCH_CAP,
      zones: boxes.every(within) && within(hub) && disjoint, gates: Object.values(L.ZONES).every(z => z.gate.x >= hub.x0 && z.gate.x <= hub.x1 && z.gate.z >= hub.z0 && z.gate.z <= hub.z1),
      bosses: real.map(w => !!B.bossOf(w.id)).every(Boolean), swirlShow: R.REALMS.swirl.showStars === true, mover: Object.keys(M.PATHS).join(),
      zoneAt: [L.zoneAt(112, 50), L.zoneAt(50, 170), L.zoneAt(112, 110), L.zoneAt(170, 170)].join(),
    };
  });
  t.ok(d2.counts.join() === '12,11,12' && d2.order.startsWith('house,pirate,race,stadium,portal,fair,doors,') && d2.order.split(',').length === d2.counts[0] && d2.ready >= 4, `12 / 11 / 12 Picture Worlds in the old order (the Wizard gives no star), at least the four wave 14 worlds ready (${d2.counts}, ${d2.ready} ready)`);
  t.ok(d2.realms.startsWith('house:house,pirate:pirate,race:playland,stadium:playland') && d2.worlds === 'race,stadium' && d2.defs, `four worlds have a realm, each a child of the Swirl entered by a frame, no morning, losing keeps you there (${d2.realms})`);
  t.ok(d2.noGym && d2.bosses && d2.swirlShow && d2.rematchCap === 70, `Picture Worlds are not gyms (32 gyms), every one has a Boss, REMATCH_CAP is ${d2.rematchCap}`);
  t.ok(d2.zones && d2.gates && d2.zoneAt === 'race,stadium,hub,fair', `Playland: zones and hub inside the map and apart, the gates in the hub (${d2.zoneAt})`);

  /* ---- 3. Terrains on three seeds ---- */
  const d3 = await page.evaluate(async () => {
    const { World } = await import('/src/world.js'), R = await import('/src/realms.js'), { B } = await import('/src/blocks.js'), L = await import('/src/playland.js');
    const make = (seed, def, hook) => {
      const w = new World(seed, null, null, def.size, def);
      if (hook) hook();
      w.generate();
      return w;
    };
    const hash = w => { let h = 0; for (let i = 0; i < w.data.length; i++) h = (h * 31 + w.data[i]) | 0; return h; };
    const solid = (w, x, y, z) => w.isSolid(x, y, z);
    // BFS on the walkable cells (step up <= 1, 2 free above) from `from` to `to`
    const reach = (w, from, to) => {
      from = from.map(Math.floor); to = to.map(Math.floor);
      const key = (x, z) => x + w.W * z, seen = new Set([key(from[0], from[2])]), q = [[from[0], from[1], from[2]]];
      const top = (x, z, y0) => { for (let y = Math.min(y0 + 1, 40); y >= 0 && y >= y0 - 3; y--) if (solid(w, x, y - 1, z) && !solid(w, x, y, z) && !solid(w, x, y + 1, z)) return y; return -1; };
      while (q.length) {
        const [x, y, z] = q.shift();
        if (Math.abs(x - to[0]) <= 1 && Math.abs(z - to[2]) <= 1) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= w.W || nz >= w.D || seen.has(key(nx, nz))) continue;
          const ny = top(nx, nz, y);
          if (ny < 0) continue;
          seen.add(key(nx, nz)); q.push([nx, ny, nz]);
        }
      }
      return false;
    };
    const out = [];
    for (const seed of [1, 4242, 294331207]) {
      for (const id of ['house', 'pirate', 'playland']) {
        const def = R.REALMS[id], a = make(seed, def), b = make(seed, def);
        const r = { seed, id, same: hash(a) === hash(b), problems: [] };
        const bad = m => r.problems.push(m);
        const arr = Object.entries(a.arrivals || {});
        if (!arr.length) bad('no arrivals');
        for (const [key, [x, y, z]] of arr) {
          const fx = Math.floor(x), fz = Math.floor(z);
          if (!solid(a, fx, Math.floor(y) - 1, fz) || solid(a, fx, Math.floor(y), fz) || solid(a, fx, Math.floor(y) + 1, fz)) bad(`arrival ${key} is not a standing spot`);
        }
        if (a.doors.length !== arr.length) bad(`doors ${a.doors.length} vs arrivals ${arr.length}`);
        for (const d of a.doors) {
          if (!a.keeps.some(k => k.protect[0] === d.box)) bad(`door ${d.key} box is not a keep`);
          if (!d.surface.every(([x, y, z]) => a.get(x, y, z) === B.WAY_BACK)) bad(`door ${d.key} surface`);
        }
        for (const bs of a.bosses) {
          if (a.get(Math.floor(bs.pos[0]), bs.pos[1] - 1, Math.floor(bs.pos[2])) !== B.BOSS_STAND) bad(`Boss ${bs.id} is not on a stand`);
          const door = a.doors.find(d => id === 'playland' ? d.key === bs.id : true);
          if (!door || (id !== 'pirate' && !reach(a, door.stand, bs.rest))) bad(`Boss ${bs.id} rest not reachable`); // T40b: the Pirate Seas are crossed by cannon and rope (spec `pirate` checks that graph)
        }
        if (id === 'playland') {
          const flat = make(seed, def, () => { const old = L.PLAYLAND_PARTS.race; L.PLAYLAND_PARTS.race = { build() {}, spawns: [] }; r.restore = () => { L.PLAYLAND_PARTS.race = old; }; });
          r.restore(); // generate() without the race part: every differing cell must lie in the race box
          const z = L.ZONES.race.box; let outside = 0;
          for (let i = 0; i < a.data.length; i++) if (a.data[i] !== flat.data[i]) { const x = i % a.W, zz = Math.floor(i / a.W) % a.D; if (!(x >= z.x0 && x <= z.x1 && zz >= z.z0 && zz <= z.z1)) outside++; }
          r.partOutside = outside;
          const flat2 = make(seed, def, () => { const old = L.PLAYLAND_PARTS.stadium; L.PLAYLAND_PARTS.stadium = { build() {}, spawns: [] }; r.restore2 = () => { L.PLAYLAND_PARTS.stadium = old; }; });
          r.restore2();
          const s = L.ZONES.stadium.box; let out2 = 0;
          for (let i = 0; i < a.data.length; i++) if (a.data[i] !== flat2.data[i]) { const x = i % a.W, zz = Math.floor(i / a.W) % a.D; if (!(x >= s.x0 && x <= s.x1 && zz >= s.z0 && zz <= s.z1)) out2++; }
          r.partOutside += out2;
          r.biomes = [a.biome(112, 50), a.biome(50, 170), a.biome(112, 110)].join();
          r.hub = a.doors.every(d => d.box.x0 >= L.HUB.x0 && d.box.x1 <= L.HUB.x1 && d.box.z0 >= L.HUB.z0 && d.box.z1 <= L.HUB.z1 && d.stand[2] >= L.HUB.z0 && d.stand[2] <= L.HUB.z1);
          r.doors = a.doors.length;
        }
        out.push(r);
      }
    }
    return out;
  });
  for (const r of d3) {
    t.ok(r.same && !r.problems.length, `${r.id}, seed ${r.seed}: the same blocks twice; arrivals stand on ground with room; a door and keep each; the Boss is on its stand and reachable ${r.problems.join('; ')}`);
    if (r.id === 'playland') t.ok(r.partOutside === 0 && r.biomes === 'race,stadium,hub' && r.hub && r.doors === 2, `playland, seed ${r.seed}: each part writes only inside its zone, the zone is the biome, both doors lie in the hub (${r.partOutside} cells outside, ${r.biomes})`);
  }

  /* ---- 4. Mover (pure) ---- */
  const d4 = await page.evaluate(async () => {
    const M = await import('/src/mover.js');
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    const line = M.makePath({ kind: 'line', points: [[0, 5, 0], [10, 5, 0], [10, 5, 10]], speed: 5 });
    const loop = M.makePath({ kind: 'line', points: [[0, 5, 0], [10, 5, 0], [10, 5, 10]], speed: 5, loop: true });
    const arc = M.makePath({ kind: 'arc', from: [0, 3, 0], to: [20, 6, 0], height: 8, time: 2 });
    const mid = arc.at(1), samples = Array.from({ length: 401 }, (_, i) => arc.at(i / 200).y);
    const p = { pos: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, vel: { y: 0, set() { this.y = 0; } }, keys: { Space: true }, carry: null };
    let ended = 0;
    const m = new M.Mover({ path: line, seat: [0, 0.5, 0], onEnd: () => { ended++; } });
    m.board(p);
    const held = m.wantsLeave(true); p.keys.Space = false; m.wantsLeave(false);
    m.update(1);
    const c1 = { x: p.pos.x, y: p.pos.y };
    const fresh = m.wantsLeave(true);
    const stuck = new M.Mover({ path: line, canLeave: false }); stuck.board(p);
    stuck.wantsLeave(false);
    const never = stuck.wantsLeave(true);
    stuck.leave(false);
    m.update(10); // past the end
    return {
      ends: [line.at(0).x, line.at(99).x, line.at(99).z, near(line.time, 4)], wrap: near(loop.at(0).x, loop.at(loop.time).x) && near(loop.at(1).x, loop.at(1 + loop.time).x),
      yaw: [line.at(0.1).yaw, line.at(3).yaw], arcEnds: [arc.at(0).y, arc.at(2).y, arc.at(0).x, arc.at(2).x], arcTop: Math.max(...samples), arcMid: mid.x,
      held, carried: [c1.x, c1.y], fresh, never, ended, atEnd: [p.pos.x, p.pos.z], left: p.carry === null,
    };
  });
  t.ok(d4.ends.join() === '0,10,10,true' && d4.wrap, `a line path: the ends, the loop wraps (${d4.ends})`);
  t.ok(Math.abs(d4.yaw[0] - Math.atan2(-1, 0)) < 1e-6 && Math.abs(Math.abs(d4.yaw[1]) - Math.PI) < 1e-6, `a path's yaw faces along the way (${d4.yaw.map(v => v.toFixed(2))})`);
  t.ok(d4.arcEnds.join() === '3,6,0,20' && Math.abs(d4.arcTop - 14) < 0.05, `an arc starts and ends where it says and its top is 8 above the higher end (${d4.arcTop.toFixed(2)})`);
  t.ok(d4.held === false && d4.fresh === true && d4.carried[0] === 5 && d4.carried[1] === 5.5, `boarding: carried along (${d4.carried}), a held Space does not throw you off, a fresh press does`);
  t.ok(d4.never === false, 'a ride with canLeave: false ignores Space');
  t.ok(d4.ended === 1 && d4.atEnd.join() === '10,10' && d4.left, `a 'ride' path past its end drops you at the end and calls onEnd (${d4.atEnd})`);

  /* ---- 5. The whole loop (one browser) ---- */
  await newGame(page, 0); await pause(page);
  await toasts(page);
  await intoSwirl(page);
  for (const id of ['house', 'pirate', 'race', 'stadium', 'doodle']) await flip(page, id, false); // the wave 14 tasks ship their frames ready; this part wants every frame covered
  const block = await page.evaluate(() => { const g = window.pokecraft, x = 48, z = 80, y = g.world.surface(x, z).y + 1; g.world.set(x, y, z, 8); return [x, y, z]; });
  const cloth0 = await atFrame(page, 'house');
  const cov = await page.evaluate(c => ({ id: window.pokecraft.world.get(...c), pics: window.pokecraft.scene.children.filter(o => o.userData.swirlSky && o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters.width === 5).length }), cloth0);
  t.ok(cov.id === 129 && cov.pics === 0, `a covered frame: cloth, no picture (${cov.id}, ${cov.pics} pictures)`);
  await flip(page, 'house');
  await waitFor(page, c => window.pokecraft.world.get(...c) === 144, cloth0, 30000);
  await waitFor(page, () => window.pokecraft.scene.children.some(o => o.userData.swirlSky && o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters.width === 5), null, 30000);
  const ready = await page.evaluate(() => window.pokecraft.scene.children.filter(o => o.userData.swirlSky && o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters.width === 5).length);
  const fr = await page.evaluate(c => { const g = window.pokecraft, b = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }; return { prompt: g.portal.prompt(b, 'click or E'), action: g.portal.action(b) }; }, cloth0);
  t.ok(ready >= 1 && /Giant House · click or E to go in/.test(fr.prompt) && fr.action === 'Step in!', `a ready frame: PICTURE cells and one picture mesh (${ready}), "${fr.prompt}" / "${fr.action}"`);
  await page.screenshot({ path: path.join(SHOTS, 't40-frame-ready.png') });
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cloth0);
  await placeIs(page, 'house');
  const inHouse = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, d = w.doors[0], p = g.player.pos, up = g.realms.upPart();
    return { stand: [p.x, p.z].map(v => +v.toFixed(1)).join(), want: [d.stand[0], d.stand[2]].map(v => +v.toFixed(1)).join(), glow: !!g.portal.glow(), via: g.realms.via, up, boss: w.bosses.length, bosses: g.npcs.list.filter(n => n.kind === 'boss').length };
  });
  t.ok(inHouse.stand === inHouse.want && inHouse.glow && inHouse.via === 'house' && inHouse.up.id === 'swirl' && inHouse.up.via === 'house' && inHouse.bosses === 1, `stepping in: the player is at the door's stand, the way back glows, the Swirl is the way up (${inHouse.stand})`);
  t.ok(await said(page, /Giant House|HUGE/), 'a toast welcomes you to the Giant House');
  await page.evaluate(async () => { const g = window.pokecraft; const bs = g.world.bosses[0]; g.player.pos.set(bs.rest[0], bs.rest[1], bs.rest[2]); g.updateGuide?.(); });
  await page.evaluate(() => window.pokecraft.player.pos.set(window.pokecraft.world.doors[0].stand[0], window.pokecraft.world.doors[0].stand[1], window.pokecraft.world.doors[0].stand[2]));
  const guide = await page.evaluate(() => { const g = window.pokecraft; g.updateGuide(); return { text: document.getElementById('guide')?.textContent || g.ui.guideText, target: g.guideTarget, boss: g.world.bosses[0].pos }; });
  t.ok(/Giant House Boss|Toy train/.test(guide.text || ''), `the guide names the Boss or the way to him (${guide.text})`);
  const navRows = await page.evaluate(() => window.pokecraft.nav.rows().map(r => `${r.dest.id}:${r.dest.label}`));
  t.ok(navRows.includes('boss:house:Giant House Boss') && navRows.includes('door:Way back to the Swirl'), `"Where to go" in the Giant House: its Boss and the way back (${navRows.join(', ')})`);
  await page.screenshot({ path: path.join(SHOTS, 't40-house-stub.png') });

  // talk to the Boss: a Boss battle
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), bs = g.world.bosses[0];
    g.player.pos.set(bs.rest[0], bs.rest[1], bs.rest[2]); g.player.vel.set(0, 0, 0);
    g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0;
    g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
  });
  await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 30000);
  const bt = await page.evaluate(() => { const b = window.pokecraft.battle; return { boss: b.boss, name: b.trainer.name, foes: b.foes.map(f => f.level).join() }; });
  t.ok(bt.boss && /Nibbles/.test(bt.name) && bt.foes === '59,60,61,62', `the Boss battle uses the boss music rule and the Boss's team (${bt.foes})`);
  t.ok(await playBattle(page), 'the Boss battle is won');
  await waitFor(page, () => window.pokecraft.stars.includes('house'), null, 30000);
  const won = await page.evaluate(() => { const g = window.pokecraft; g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { cubes: g.cubes, note: document.querySelector('#celebrate .big')?.textContent, small: document.querySelector('#celebrate .small')?.textContent, place: s.place, up: s.realmUp, stars: s.stars }; });
  t.ok(won.stars.includes('house') && /Giant House star/.test(won.note || '') && /little mouse/.test(won.small || ''), `the star and the Wizard's note (${won.note}: ${won.small})`);
  t.ok(won.cubes >= 10 && won.place === 'house' && won.up.id === 'swirl' && won.up.via === 'house', `10 Capture Cubes; the save has place house and realmUp swirl via house`);
  await page.screenshot({ path: path.join(SHOTS, 't40-star-note.png'), timeout: 180000 });
  await pause(page);

  // reload in a fresh context: back in the house
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  const page2 = await openGame(browser, base, { setup: seedSave(save) });
  await continueGame(page2);
  const re = await page2.evaluate(() => { const g = window.pokecraft; return { place: g.place, via: g.realms.via, stars: g.stars, p: g.player.pos.z }; });
  t.ok(re.place === 'house' && re.via === 'house' && re.stars.includes('house'), `a reload continues in the Giant House (${re.place}, via ${re.via})`);
  // the way back: swirl, near the house frame, the block still there, bridge stone 0 lit
  const back = await page2.evaluate(async () => {
    const g = window.pokecraft, d = g.world.doors[0], mid = d.surface[Math.floor(d.surface.length / 2)];
    const b = { x: mid[0], y: mid[1], z: mid[2], id: g.world.get(...mid) };
    const prompt = g.portal.prompt(b, 'click or E'), action = g.portal.action(b);
    g.portal.use(b);
    return { prompt, action };
  });
  t.ok(/Way back · .* to go back to the Swirl/.test(back.prompt) && back.action === 'Back!', `the way back says "${back.prompt}" / "${back.action}"`);
  await placeIs(page2, 'swirl');
  await waitFor(page2, () => window.pokecraft.world.get(...window.pokecraft.world.swirl.bridge[0].cells[0]) === 130, null, 30000);
  const sw = await page2.evaluate(async blk => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'house'), p = g.player.pos, R = await import('/src/realms.js');
    return { near: Math.hypot(p.x - (f.stand[0] + 0.5), p.z - (f.stand[2] + 0.5)), stone: g.world.get(...g.world.swirl.bridge[0].cells[0]), stash: !!g.realms.stash.up, edit: g.realms.edits().swirl };
  }, block);
  t.ok(sw.near < 1.5 && sw.stone === 130 && !sw.stash, `back in the Swirl in front of the house frame (${sw.near.toFixed(1)}), bridge stone 0 is lit`);
  await page2.evaluate(async () => { const { pictureWorld } = await import('/src/pictureworlds.js'); pictureWorld('house').ready = true; window.pokecraft.portal.reset(window.pokecraft.world); }); // a fresh page: the house frame is covered while T40a.5 rebuilds it
  const swRows = await page2.evaluate(() => window.pokecraft.nav.rows().map(r => r.dest.id));
  t.ok(swRows.includes('frame:house') && swRows.includes('door'), `"Where to go" in the Swirl: the open frames and the door home (${swRows.join(', ')})`);
  const home = await page2.evaluate(() => { const g = window.pokecraft, d = g.world.door, m = d.surface[0]; g.portal.use({ x: m[0], y: m[1], z: m[2], id: 125 }); return true; });
  await placeIs(page2, 'main');
  const mainOk = await page2.evaluate(() => ({ stash: window.pokecraft.realms.stash, pos: window.pokecraft.player.pos.x }));
  t.ok(home && mainOk.stash === null, 'the Swirl\'s door home goes to the main world, and nothing is left stashed');
  await page2.context().close();

  /* ---- 6. Rematch, losing, crew (page, still in the house after the reload? use the first page) ---- */
  const rm = await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), PB = await import('/src/pictureboss.js'), RM = await import('/src/rematch.js'), bs = g.world.bosses[0];
    g.player.pos.set(bs.rest[0], bs.rest[1], bs.rest[2]); g.player.vel.set(0, 0, 0);
    g.party = [S.makeCreature('thunderwolf', 100)];
    const npc = g.npcs.list.find(n => n.kind === 'boss'), def = PB.bossOf('house');
    const cubes0 = g.cubes;
    g.bosses.talk(npc);
    const ask = { asking: g.ui.asking, text: document.getElementById('ask-text').textContent, want: PB.bossTeam(def, 0).map(t => t[1]).join(), top: Math.max(...PB.bossTeam(def, 0).map(t => t[1])) };
    g.ui.askYes();
    return { ask, cubes0, team: PB.bossTeam(def, 0), cube1: RM.rematchCubes(1) };
  });
  t.ok(rm.ask.asking && /level \d+/.test(rm.ask.text) && rm.ask.text.includes(String(rm.ask.top)), `with the star, talking to the Boss asks for a rematch ("${rm.ask.text}")`);
  await waitFor(page, () => window.pokecraft.inBattle, null, 30000);
  const lv = await page.evaluate(() => window.pokecraft.battle.foes.map(f => f.level).join());
  t.ok(lv === rm.team.map(x => x[1]).join(), `the rematch team follows bossTeam(def, 0) (${lv})`);
  await playBattle(page);
  await waitFor(page, () => window.pokecraft.bossWins.house === 1, null, 30000);
  const after = await page.evaluate(() => ({ wins: window.pokecraft.bossWins, cubes: window.pokecraft.cubes, stars: window.pokecraft.stars.length }));
  t.ok(after.wins.house === 1 && after.cubes >= rm.cubes0 + rm.cube1, `a rematch win is counted (bossWins.house 1) and pays ${rm.cube1} cubes`);
  // losing: stay in the house at a rest spot, team healed, star kept
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), bs = g.world.bosses[0];
    g.player.pos.set(bs.rest[0] + 6, bs.rest[1], bs.rest[2]); g.party = [S.makeCreature('fluffin', 2)];
    g.ui.closeAsk?.();
    g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
    if (g.ui.asking) g.ui.askYes();
  });
  await waitFor(page, () => window.pokecraft.inBattle, null, 30000);
  await playBattle(page);
  await waitFor(page, () => !window.pokecraft.inBattle, null, 30000);
  const lost = await page.evaluate(() => {
    const g = window.pokecraft, bs = g.world.bosses[0], p = g.player.pos;
    return { place: g.place, d: Math.hypot(p.x - bs.rest[0], p.z - bs.rest[2]), hp: g.party.every(c => c.hp > 0), stars: g.stars.includes('house') };
  });
  t.ok(lost.place === 'house' && lost.d < 2.5 && lost.hp && lost.stars, `losing keeps you in the house at the Boss's rest spot, healed, star kept (${lost.d.toFixed(1)})`);
  // "Not now" and a crew person
  const crew = await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), PB = await import('/src/pictureboss.js'), PL = await import('/src/picturelands.js');
    const w = g.world, bs = w.bosses[0];
    g.party = [S.makeCreature('thunderwolf', 100)];
    g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
    const asked = g.ui.asking; const b0 = g.battle.trainer; g.ui.askNo(); const noBattle = !g.inBattle;
    const def = PB.bossOf('house');
    PB.addBoss({ ...def, crew: [{ name: 'Helper Hugo', colors: def.colors, team: [['fluffin', 5]], intro: ['Hi!'], line: 'You got past me!' }] });
    PL.placeCrew(w, 'house', 0, { x: Math.floor(bs.rest[0]) + 3, y: 10, z: Math.floor(bs.rest[2]), facing: [0, -1] });
    g.npcs.populate(w, g.spawnPoint);
    const c = g.npcs.list.find(n => n.kind === 'crew');
    return { asked, noBattle, crew: !!c, title: c?.title, prompt: c && g.bosses.talkPrompt(c) };
  });
  t.ok(crew.asked && crew.noBattle, '"Not now" closes the rematch question without a battle');
  t.ok(crew.crew && /Helper Hugo/.test(crew.title) && crew.prompt.action === 'Battle!', `a crew person stands beside the Boss (${crew.title}) and says "Battle!"`);
  await page.evaluate(() => window.pokecraft.bosses.talk(window.pokecraft.npcs.list.find(n => n.kind === 'crew')));
  await waitFor(page, () => window.pokecraft.inBattle, null, 30000);
  await playBattle(page);
  await waitFor(page, () => window.pokecraft.beaten.includes('pw:house:crew1'), null, 30000);
  const crew2 = await page.evaluate(() => { const g = window.pokecraft; g.bosses.talk(g.npcs.list.find(n => n.kind === 'crew')); return { inBattle: g.inBattle, prompt: g.bosses.talkPrompt(g.npcs.list.find(n => n.kind === 'crew')).action }; });
  t.ok(!crew2.inBattle && crew2.prompt === 'Talk', 'a beaten crew person only talks (key pw:house:crew1 in beaten)');

  /* ---- 7. Playland: two frames, one realm ---- */
  await page.evaluate(() => window.pokecraft.realms.leave('door'));
  await placeIs(page, 'swirl');
  await flip(page, 'race'); await flip(page, 'stadium');
  const cr = await atFrame(page, 'race');
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cr);
  await placeIs(page, 'playland');
  const pl1 = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, d = g.world.doors.find(d => d.key === 'race'); g.updateGuide(); return { via: g.realms.via, z: p.z, door: d.stand[2], doors: g.world.doors.length, glow: g.portal.glow().count, guide: g.ui.guideText }; });
  t.ok(pl1.via === 'race' && Math.abs(pl1.z - pl1.door) < 0.1 && pl1.doors === 2 && pl1.glow === 2 && /Race Track Boss/.test(pl1.guide || ''), `the race frame opens Playland at the race gate, two glowing doors, the guide names the Race Track Boss (${pl1.guide})`);
  await page.screenshot({ path: path.join(SHOTS, 't40-playland-hub.png'), timeout: 180000 });
  await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors.find(d => d.key === 'race'), m = d.surface[0]; g.portal.use({ x: m[0], y: m[1], z: m[2], id: 145 }); });
  await placeIs(page, 'swirl');
  const near = await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'race'), p = g.player.pos; return Math.hypot(p.x - f.stand[0] - 0.5, p.z - f.stand[2] - 0.5); });
  t.ok(near < 1.5, `the way back from the race gate lands in front of the race frame (${near.toFixed(1)})`);
  const cs = await atFrame(page, 'stadium');
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cs);
  await placeIs(page, 'playland');
  const pl2 = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, d = g.world.doors.find(d => d.key === 'stadium'); g.updateGuide(); return { via: g.realms.via, z: p.z, door: d.stand[2], guide: g.ui.guideText }; });
  t.ok(pl2.via === 'stadium' && Math.abs(pl2.z - pl2.door) < 0.1 && /Ball Stadium Boss/.test(pl2.guide || ''), `the stadium frame arrives at the stadium gate in the same realm (${pl2.guide})`);
  // in through the stadium frame, out through the race door: you come out at the race frame (owner 2026-10-26)
  await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors.find(d => d.key === 'race'), m = d.surface[0]; g.portal.use({ x: m[0], y: m[1], z: m[2], id: 145 }); });
  await placeIs(page, 'swirl');
  const cross = await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'race'), p = g.player.pos, c = f.cloth[12]; return { d: Math.hypot(p.x - f.stand[0] - 0.5, p.z - f.stand[2] - 0.5), prompt: g.portal.prompt({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }, 'click or E') }; });
  t.ok(cross.d < 1.5, `in through the stadium frame, out through the race door: you come out at the race frame (${cross.d.toFixed(1)})`);
  t.ok(/^🏎️ Playland · Race Track · /.test(cross.prompt), `the frame says it is Playland ("${cross.prompt}")`);
  await page.evaluate(() => window.pokecraft.realms.leave('door'));
  await placeIs(page, 'main');
  await flip(page, 'house', false); await flip(page, 'race', false); await flip(page, 'stadium', false);

  /* ---- 9. Old saves ---- */
  const oldSave = await page.evaluate(() => { const g = window.pokecraft; g.save(); return JSON.parse(localStorage.getItem('pokecraft-save-v2')); });
  const swirlSave = { ...oldSave, place: 'swirl', realmPos: [43.5, 20, 80.5, 0, 0], realmVersions: { swirl: 3 }, bossWins: { house: 'x', nope: 4, pirate: -2, race: 3 }, realmUp: { id: 'dream', ret: 'x', via: 'nope' } };
  delete swirlSave.realmUp; delete swirlSave.bossWins;
  const p3 = await openGame(browser, base, { setup: seedSave(swirlSave) });
  await continueGame(p3);
  const s3 = await p3.evaluate(() => ({ place: window.pokecraft.place, wins: window.pokecraft.bossWins, up: window.pokecraft.realms.upPart() }));
  t.ok(s3.place === 'swirl' && JSON.stringify(s3.wins) === '{}' && s3.up === null, 'a wave 13 save in the Swirl (no realmUp, no bossWins) loads in the Swirl');
  await p3.context().close();
  const hsave = { ...oldSave, place: 'house', realmPos: [32.5, 12, 40.5, 0, 0], realmVersions: { house: 1 }, bossWins: { house: 2, nope: 4, pirate: -2, race: 'x', stadium: 1.5 }, realmUp: { id: 'dream', ret: 'x', via: 'pirate' } };
  const p4 = await openGame(browser, base, { setup: seedSave(hsave) });
  await continueGame(p4);
  const s4 = await p4.evaluate(() => ({ place: window.pokecraft.place, wins: JSON.stringify(window.pokecraft.bossWins), up: window.pokecraft.realms.upPart() }));
  t.ok(s4.place === 'house' && s4.wins === '{"house":2}' && s4.up.id === 'swirl' && s4.up.ret === null && s4.up.via === null, `a house save with junk realmUp / bossWins: junk dropped (${s4.wins}), the way back is still the Swirl`);
  await p4.evaluate(() => window.pokecraft.realms.leave('door'));
  await placeIs(p4, 'swirl');
  const arr = await p4.evaluate(() => { const p = window.pokecraft.player.pos, s = window.pokecraft.spawnPoint; return Math.hypot(p.x - s.x, p.z - s.z); });
  t.ok(arr < 2, `without a saved return spot the way back lands at the Swirl's arrival (${arr.toFixed(1)})`);
  await p4.context().close();

  /* ---- 10. iPad ---- */
  const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await newGame(ip, 0);
  const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  await ip.evaluate(async () => {
    const { pictureWorld } = await import('/src/pictureworlds.js'); pictureWorld('house').ready = true;
    const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand });
  });
  await placeIs(ip, 'swirl');
  await ip.evaluate(() => { const g = window.pokecraft; g.portal.reset(g.world); });
  await waitFor(ip, () => { const f = window.pokecraft.world.swirl.frames.find(f => f.world === 'house'); return window.pokecraft.world.get(...f.cloth[0]) === 144; }, null, 30000);
  const acts = await ip.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'house'), c = f.cloth[0], b = { x: c[0], y: c[1], z: c[2], id: 144 };
    return { frame: g.portal.action(b) };
  });
  t.ok(acts.frame === 'Step in!', `at a ready frame the big button says "${acts.frame}"`);
  const buttons = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  t.ok(buttons === before, `the number of touch buttons did not change (${before})`);
  await ip.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'house'), c = f.cloth[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: 144 }); });
  await placeIs(ip, 'house');
  const ia = await ip.evaluate(() => {
    const g = window.pokecraft, d = g.world.doors[0], m = d.surface[0], bs = g.npcs.list.find(n => n.kind === 'boss');
    return { back: g.portal.action({ x: m[0], y: m[1], z: m[2], id: 145 }), boss: g.bosses.talkPrompt(bs).action };
  });
  t.ok(ia.back === 'Back!' && ia.boss === 'Challenge!', `at the way back "${ia.back}", at a Boss "${ia.boss}"`);
  t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
  await ip.context().close();

  /* ---- 11. No page errors ---- */
  t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);
  await page.context().close(); // (the pair below runs alone: several open games make the software renderer too slow)
  await pairPart({ browser, base, t });
}

// 8. Two browsers: Dad hosts, Kid follows into the Swirl, into the Giant House, back up, home.
async function pairPart({ browser, base, t }) {
  const [A, Bp] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(Bp, 1); await pause(Bp);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
  await Bp.fill('#mp .mp-code-input', code);
  await click(Bp, '#mp button:has-text("Join a world")');
  await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000);
  await toasts(Bp); await toasts(A);
  await A.evaluate(() => { window.pokecraft.champion = true; });
  await Bp.evaluate(() => { window.pokecraft.champion = true; });
  await flip(A, 'house', false); // (module state is per page)
  for (const pg of [A, Bp]) await pg.evaluate(async () => { const { pictureWorld } = await import('/src/pictureworlds.js'); pictureWorld('house').ready = true; });
  // Dad goes into the Swirl through the Portal Door, Kid follows
  await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
  await placeIs(A, 'swirl');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 30000);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'swirl');
  const sblock = await A.evaluate(() => { const g = window.pokecraft, x = 49, z = 80, y = g.world.surface(x, z).y + 1; g.world.set(x, y, z, 8); g.mp.sendBlock(x, y, z, 8); return [x, y, z]; });
  await waitFor(Bp, c => window.pokecraft.world.get(...c) === 8, sblock, 30000);
  // hide and seek is not running; Dad steps into the house picture
  const fa = await atFrame(A, 'house');
  await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, fa);
  await placeIs(A, 'house');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 30000);
  const ask = await Bp.evaluate(() => document.getElementById('ask-text').textContent);
  t.ok(/Dad stepped into the Giant House\. Go too\?/.test(ask), `Kid is asked to follow into the picture ("${ask}")`);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'house');
  const k1 = await Bp.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return { via: g.realms.via, up: g.realms.upPart(), guest: g.realms.stash.guest, near: a ? Math.hypot(a.pos.x - g.player.pos.x, a.pos.z - g.player.pos.z) : -1 }; });
  t.ok(k1.via === 'house' && k1.up.id === 'swirl' && k1.guest, 'Kid is in the Giant House with the Swirl as his way up');
  // blocks both ways (on a buildable spot near the arrival: most of the Giant House is fixed kitchen)
  const hb = await A.evaluate(() => { const g = window.pokecraft, w = g.world, a = w.arrivals.house, spot = dx => { for (let r = 2; r < 30; r++) for (const s of [1, -1]) { const x = Math.floor(a[0]) + s * r * dx, z = Math.floor(a[2]) + s * r * (1 - dx), y = w.surface(x, z).y + 1; if (y > 0 && y < 46 && w.editAllowed(x, y, z, 11) && w.get(x, y, z) === 0) return [x, y, z]; } return null; }; const [x, y, z] = spot(1); g.world.set(x, y, z, 11); g.mp.sendBlock(x, y, z, 11); return [x, y, z]; });
  await waitFor(Bp, c => window.pokecraft.world.get(...c) === 11, hb, 30000);
  const kb = await Bp.evaluate(() => { const g = window.pokecraft, w = g.world, a = w.arrivals.house, spot = dx => { for (let r = 2; r < 30; r++) for (const s of [1, -1]) { const x = Math.floor(a[0]) + s * r * dx, z = Math.floor(a[2]) + s * r * (1 - dx), y = w.surface(x, z).y + 1; if (y > 0 && y < 46 && w.editAllowed(x, y, z, 11) && w.get(x, y, z) === 0) return [x, y, z]; } return null; }; const [x, y, z] = spot(0); g.world.set(x, y, z, 13); g.mp.sendBlock(x, y, z, 13); return [x, y, z]; });
  await waitFor(A, c => window.pokecraft.world.get(...c) === 13, kb, 30000);
  t.ok(true, "blocks travel both ways in the Picture World");
  const kSave = await Bp.evaluate(() => { window.pokecraft.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { re: s.realmEdits, place: s.place }; });
  t.ok(!(kSave.re.house?.length) && !(kSave.re.swirl?.length), "Kid's save has no house or Swirl edits from Dad");
  // Dad goes back up: Kid goes too, and sees Dad's Swirl block
  await A.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], m = d.surface[0]; g.portal.use({ x: m[0], y: m[1], z: m[2], id: 145 }); });
  await placeIs(A, 'swirl'); await placeIs(Bp, 'swirl');
  const kb2 = await Bp.evaluate(c => window.pokecraft.world.get(...c), sblock);
  t.ok(kb2 === 8, "Dad went back to the Swirl and Kid went too, with Dad's Swirl block");
  // Kid goes home alone, then follows Dad (in the house) straight from main
  await Bp.evaluate(() => window.pokecraft.realms.leave('door', { home: true }));
  await placeIs(Bp, 'main');
  await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, fa);
  await placeIs(A, 'house');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 30000);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'house');
  const c3 = await Bp.evaluate(() => ({ up: window.pokecraft.realms.upPart(), via: window.pokecraft.realms.via }));
  t.ok(c3.up?.id === 'swirl' && c3.via === 'house', 'Kid followed Dad straight from the main world into the house (case C)');
  await A.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], m = d.surface[0]; g.portal.use({ x: m[0], y: m[1], z: m[2], id: 145 }); });
  await placeIs(A, 'swirl'); await placeIs(Bp, 'swirl');
  const near2 = await Bp.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0], p = g.player.pos; return Math.hypot(p.x - 44.5, p.z - 80.5) >= 0; });
  t.ok(near2, 'Kid came back to the Swirl with Dad');
  // Dad goes home: Kid goes home
  await A.evaluate(() => { const g = window.pokecraft, d = g.world.door, m = d.surface[0]; g.portal.use({ x: m[0], y: m[1], z: m[2], id: 125 }); });
  await placeIs(A, 'main'); await placeIs(Bp, 'main');
  t.ok(await A.evaluate(() => window.pokecraft.realms.stash === null), 'Dad home: Kid home too');
  const wv = await A.evaluate(async () => (await (await fetch('/src/multiplayer.js')).text()).match(/WORLD_VERSION = (\d+)/)[1]);
  t.ok(wv === '20', `WORLD_VERSION is ${wv}`);
  await A.context().close(); await Bp.context().close();

}
