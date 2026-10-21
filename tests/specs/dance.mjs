// The Echo Gym's dance-off (src/dancefloor.js): data (rounds, steps, pad blocks, sounds), the pads drawn on the old
// building without any edit, Melody asking for a dance after her trainer, a wrong step showing the round again, copying
// every round, the badge battle, a lost battle keeping the dance, the next (rematch) dance, saving the key, and an old
// save with the badge, the beaten trainer and rematch wins keeping all of them. Saves tests/screenshots/dance-*.png.
import fs from 'node:fs';
import { openGame, newGame, playBattle, continueGame, seedSave } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);

  /* 1. Data */
  const d = await page.evaluate(async () => {
    const D = await import('/src/dancefloor.js');
    const { B, BLOCKS, PLACEABLE, TILE_COUNT } = await import('/src/blocks.js');
    const { sound } = await import('/src/sound.js');
    const { GYMS } = await import('/src/gyms.js');
    const { LIVE } = await import('/src/gymlive.js');
    const fake = (badge, wins) => ({ badges: badge ? ['sound'] : [], rematchWins: { sound: wins } });
    const def = GYMS.find(g => g.id === 'sound');
    let repeats = 0, lens = true;
    for (let n = 0; n < 200; n++) {
      const s = D.danceSteps(7);
      if (s.length !== 7 || s.some(k => k < 0 || k > 3)) lens = false;
      for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) repeats++;
    }
    const pads = [0, 1, 2, 3].flatMap(k => [`DANCE_${k}`, `DANCE_${k}_LIT`]).map(n => ({ n, id: B[n], b: BLOCKS[B[n]] }));
    return {
      first: D.danceRounds(fake(false, 0), def).join(), re0: D.danceRounds(fake(true, 0), def).join(), re9: D.danceRounds(fake(true, 9), def).join(),
      repeats, lens,
      ids: pads.map(p => p.id).join(),
      blocks: pads.every(p => p.b && !PLACEABLE.includes(p.id) && p.b.wallText && ['top', 'side', 'bottom'].every(f => p.b[f] < TILE_COUNT)),
      lit: pads.filter(p => p.n.endsWith('_LIT')).every(p => p.b.glow && p.b.noLight) && pads.filter(p => !p.n.endsWith('_LIT')).every(p => !p.b.glow),
      sounds: ['dancepad0', 'dancepad1', 'dancepad2', 'dancepad3', 'danceoops', 'danceyay'].every(n => sound.has(n)),
      def: def.live === 'dance' && def.keys.join() === 'danced' && LIVE.dance === D.DanceLive,
      order: GYMS.map(g => g.id).indexOf('sound'),
    };
  });
  t.ok(d.first === '2,3,4' && d.re0 === '3,4,5' && d.re9 === '3,4,7', `rounds: first ${d.first}, rematch ${d.re0}, after many wins ${d.re9}`);
  t.ok(d.lens && d.repeats === 0, 'a dance never has the same pad twice in a row');
  t.ok(d.ids === '105,109,106,110,107,111,108,112' && d.blocks && d.lit, 'pad blocks 105-112: not placeable, lit ones glow without lighting the room');
  t.ok(d.sounds && d.def, 'the six dance sounds, the def has live: dance and the key "danced"');
  t.ok(d.order === 7, `the Echo Gym keeps its place in GYMS (${d.order})`);

  /* 2. The game */
  await newGame(page, 1);
  await page.evaluate(async () => {
    const g = window.pokecraft;
    g.creatures.clear(); document.exitPointerLock();
    window.__toasts = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) window.__toasts.push(n.textContent); })
      .observe(document.getElementById('toast'), { childList: true });
    const { makeCreature } = await import('/src/species.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 70));
    window.__T = 0;
    g.gymLive.of('sound').now = () => window.__T;
  });
  const toasts = () => page.evaluate(() => window.__toasts.join(' | '));
  const clearToasts = () => page.evaluate(() => { window.__toasts.length = 0; });
  const info = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'sound'), L = g.gymLive.of('sound');
    return { x: gym.x, z: gym.z, y: gym.y, front: gym.front, pads: L.pads, fy: L.fy, edits: g.world.edits.size };
  });
  const [fx, fz] = info.front;
  const inside = (d, s = 0) => [info.x + 0.5 + fx * d + fz * s, info.z + 0.5 + fz * d + fx * s];
  const place = (x, z, look = [-fx, -fz]) => page.evaluate(([x, y, z, look]) => {
    const g = window.pokecraft;
    g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0); g.player.onGround = true;
    g.player.yaw = Math.atan2(-look[0], -look[1]); g.player.pitch = -0.3;
  }, [x, info.y, z, look]);
  const live = () => page.evaluate(() => window.pokecraft.gymLive.of('sound').state());
  const tick = dt => page.evaluate(dt => { window.__T += dt; window.pokecraft.gymLive.of('sound').update(0); }, dt);
  const talk = () => page.evaluate(() => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(n => n.kind === 'leader' && n.gym.def.id === 'sound')); });
  const prompt = () => page.evaluate(() => { const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'sound'); return g.gymLive.talkPrompt(n); });
  const padCell = k => { const [x, z] = info.pads[k][0]; return [x + 0.5, z + 0.5]; };
  const offPad = inside(0, 0); // the carpet between the pads and the trainer
  const step = async k => { await place(...padCell(k)); await tick(0.05); await place(...offPad); await tick(0.05); };
  const watch = async () => { // wait out the shown steps
    for (let i = 0; i < 40 && (await live()).phase === 'show'; i++) await tick(0.4);
  };
  const blockAt = (x, z) => page.evaluate(([x, y, z]) => window.pokecraft.world.get(x, y, z), [x, info.fy, z]);
  const B = await page.evaluate(async () => (await import('/src/blocks.js')).B);

  // 2a. The pads are on the floor, no edit; the planks stay in the generated world.
  const padIds = await Promise.all([0, 1, 2, 3].map(k => blockAt(...info.pads[k][0])));
  t.ok(padIds.join() === [B.DANCE_0, B.DANCE_1, B.DANCE_2, B.DANCE_3].join(), `four coloured pads on the floor (${padIds})`);
  const gen = await page.evaluate(async ([pads, fy]) => {
    const { World } = await import('/src/world.js');
    const g = window.pokecraft, w = new World(g.world.seed, null, null);
    w.generate();
    return pads.flat().map(([x, z]) => w.get(x, fy, z));
  }, [info.pads, info.fy]);
  t.ok(gen.every(id => id === B.PLANKS) && (await page.evaluate(() => window.pokecraft.world.edits.size)) === info.edits, 'the generated building is unchanged (planks) and the pads are no edits');
  const shot = async name => {
    await page.evaluate(() => { window.pokecraft.time = 0.3; document.getElementById('pause').classList.add('hidden'); });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: SHOTS + name });
    console.log(`  screenshot ${SHOTS + name}`);
  };
  await place(...inside(4));
  await shot('dance-floor.png');

  // Outside a dance-off a pad still lights up when you step on it.
  await place(...padCell(2)); await tick(0.05);
  t.ok((await blockAt(...info.pads[2][0])) === B.DANCE_2_LIT && (await live()).phase === 'idle', 'free dancing: a pad you step on lights up');
  await place(...offPad); await tick(1);
  t.ok((await blockAt(...info.pads[2][0])) === B.DANCE_2, 'and goes dark again');

  // 2b. Melody: the trainer first, then a dance-off.
  await clearToasts();
  await talk();
  t.ok((await toasts()).includes('Beat Drummer Jojo first'), `Melody wants her trainer beaten first (${await toasts()})`);
  await page.evaluate(() => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(n => n.kind === 'trainer' && n.gym.def.id === 'sound')); });
  t.ok(await playBattle(page), 'beat Drummer Jojo');
  await page.evaluate(() => document.exitPointerLock());
  await place(...offPad);
  t.ok((await prompt())?.action === 'Dance-off!', `the prompt says Dance-off! (${JSON.stringify(await prompt())})`);
  await clearToasts();
  await talk();
  let s = await live();
  t.ok(s.phase === 'show' && s.rounds.join() === '2,3,4' && s.steps.length === 4 && !(await page.evaluate(() => window.pokecraft.inBattle)), `the dance starts, no battle yet (${s.phase}, ${s.rounds})`);
  t.ok((await toasts()).includes('Dance-off!'), 'Melody explains the dance');
  // A shown pad lights up.
  await tick(0.1);
  t.ok((await blockAt(...info.pads[s.steps[0]][0])) === B[`DANCE_${s.steps[0]}_LIT`], 'the first shown pad is lit');
  await place(...inside(4));
  await shot('dance-show.png');
  await place(...offPad);
  await watch();
  s = await live();
  t.ok(s.phase === 'play', 'then it is your turn');

  // 2c. A wrong step shows the round again (no fail).
  await clearToasts();
  await step((s.steps[0] + 1) % 4);
  s = await live();
  t.ok(s.phase === 'show' && s.round === 0 && (await toasts()).includes('Watch again'), `a wrong step: "Oops! ... Watch again" and the same round (${s.phase} ${s.round})`);
  await watch();

  // 2d. Copy every round: the badge battle starts by itself (with a weak team, which loses).
  await page.evaluate(async () => { const { makeCreature } = await import('/src/species.js'); window.pokecraft.party = [makeCreature('fluffin', 2)]; });
  for (let r = 0; r < 3; r++) {
    s = await live();
    for (let i = 0; i < s.rounds[r]; i++) await step(s.steps[i]);
    if (r < 2) { s = await live(); t.ok(s.round === r + 1 && s.phase === 'show', `round ${r + 1} done, round ${r + 2} is shown`); await watch(); }
  }
  s = await live();
  t.ok(s.phase === 'cheer' && s.danced, `all rounds copied: a cheer, the key is set (${s.phase})`);
  await tick(1.5);
  const bt = await page.evaluate(() => ({ inBattle: window.pokecraft.inBattle, name: window.pokecraft.battle?.trainer?.name }));
  t.ok(bt.inBattle && bt.name === 'Leader Melody', `then Melody battles (${JSON.stringify(bt)})`);

  // 2e. Losing keeps the dance: talking again battles at once.
  await playBattle(page, 'zzz');
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    document.exitPointerLock();
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 70));
  });
  await place(...offPad);
  const lost = await page.evaluate(() => ({ badge: window.pokecraft.badges.includes('sound'), danced: window.pokecraft.keys.includes('sound:danced') }));
  t.ok(!lost.badge && lost.danced && (await prompt())?.action === 'Battle!', `a lost battle keeps the dance: the prompt says Battle! (${JSON.stringify(lost)})`);
  await talk();
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'talking again starts the battle without dancing');
  t.ok(await playBattle(page), 'beat Leader Melody');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.exitPointerLock());
  const won = await page.evaluate(() => ({ badge: window.pokecraft.badges.includes('sound'), keys: window.pokecraft.keys.filter(k => k.startsWith('sound:')).join() }));
  t.ok(won.badge && won.keys === '', `the Echo Badge; the dance key is gone after the win (${won.keys})`);

  // 2f. The rematch starts with a longer dance.
  await place(...offPad);
  t.ok((await prompt())?.action === 'Dance-off!', 'the rematch starts with a new dance');
  await talk();
  s = await live();
  t.ok(s.phase === 'show' && s.rounds.join() === '3,4,5', `the rematch dance is longer (${s.rounds})`);
  await watch();
  for (let r = 0; r < 3; r++) {
    s = await live();
    for (let i = 0; i < s.rounds[r]; i++) await step(s.steps[i]);
    if (r < 2) await watch();
  }
  await tick(1.5);
  const re = await page.evaluate(() => ({ inBattle: window.pokecraft.inBattle, rematch: !!window.pokecraft.battle?.opts?.rematch }));
  t.ok(re.inBattle, 'the rematch battle starts after the dance');
  t.ok(await playBattle(page), 'won the rematch');
  t.ok((await page.evaluate(() => window.pokecraft.rematchWins.sound)) === 1, 'the rematch win counts');

  // 2g. Walking away stops a dance.
  await page.evaluate(() => document.exitPointerLock());
  await place(...offPad);
  await talk();
  await clearToasts();
  await place(...inside(30));
  await tick(0.1);
  t.ok((await live()).phase === 'idle' && (await toasts()).includes('dance-off stopped'), 'walking away stops the dance');

  // 2h. Saving the key, and an old save keeps badge, trainer and rematch wins.
  await page.evaluate(() => { const g = window.pokecraft; g.keys.push('sound:danced'); g.save(true); });
  const save = JSON.parse(await page.evaluate(() => localStorage.getItem('pokecraft-save-v2')));
  t.ok(save.keys.includes('sound:danced'), 'the save has the dance key');
  const old = { ...save, keys: [], badges: ['sound'], beaten: ['sound:trainer'], rematchWins: { sound: 2 } };
  const p2 = await openGame(browser, base, { setup: seedSave(old) });
  await continueGame(p2);
  const o = await p2.evaluate(() => {
    const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'sound');
    const tp = g.gymLive.talkPrompt(n);
    g.talkTo(n);
    return { badge: g.badges.includes('sound'), beaten: g.beaten.includes('sound:trainer'), wins: g.rematchWins.sound, tp, st: g.gymLive.of('sound').state() };
  });
  t.ok(o.badge && o.beaten && o.wins === 2, 'an old save keeps the Echo Badge, the beaten trainer and 2 rematch wins');
  t.ok(o.tp?.action === 'Dance-off!' && o.st.rounds.join() === '3,4,7', `its next rematch is a dance (${o.st.rounds})`);
  await p2.context().close();

  t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
  await page.context().close();
}
