// Moves: data for every type, the effect kinds (heal, raise, lower, flinch, sleep, multi, recoil,
// never-miss), random-number order, the foe's choices, and the "Forget which move?" prompt.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, newGame, click, pause, playBattle, platform, startWeakBattle, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
// (The attack sounds 'fx:<type>' need no entry here: a colon can never be in a move id.)
// Sound effects that are not move sounds: a move with one of these ids would play the wrong noise.
const RESERVED_SOUNDS = ['break', 'place', 'cube', 'battle', 'hit', 'super', 'miss', 'faint', 'wobble', 'caught', 'escape', 'levelup',
  'evolve', 'win', 'badge', 'lose', 'heal', 'ask', 'thunder', 'rainbow', 'star', 'boss', 'bossloop', 'powerup', 'champion', 'statup', 'statdown', 'snooze', 'ticktock', 'popout'];


// The forget prompt, with the mouse (tap = false) or a finger (tap = true).
async function forgetPrompt(page, t, { tap, label, shot, forget }) {
  if (!tap) await pause(page);
  const press = async sel => (tap ? page.locator(sel).first().tap() : click(page, sel));
  await startWeakBattle(page, { species: 'thunderwolf', level: 22, xpToNext: true });
  await page.waitForSelector('#b-actions button:not([disabled])', { timeout: 60000 });
  const before = await page.evaluate(() => [...window.pokecraft.party[0].moves]);
  await press('#b-actions button >> nth=0'); // the first move
  await page.waitForSelector('#b-actions .b-info', { timeout: 90000 });
  const info = await page.evaluate(() => ({
    log: document.getElementById('b-log').textContent,
    buttons: [...document.querySelectorAll('#b-actions button')].map(b => b.firstChild.textContent),
    info: document.querySelector('#b-actions .b-info').textContent,
  }));
  t.ok(info.log.includes('wants to learn Grumble'), `${label}: the log says "wants to learn Grumble" (${info.log})`);
  t.ok(info.buttons.filter(b => b.startsWith('Forget ')).length === 4 && info.buttons.at(-1) === "Don't learn Grumble",
    `${label}: four Forget buttons and "Don't learn" last (${info.buttons.join(' | ')})`);
  t.ok(info.info.includes('Grumble') && info.info.includes("lowers the foe's attack"), `${label}: the new move is explained (${info.info})`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, shot) });
  if (forget) {
    await press(`#b-actions button:has-text("Forget ${forget}")`);
    await page.waitForFunction(() => window.pokecraft.party[0].moves.includes('grumble'), null, { timeout: 30000 });
    const after = await page.evaluate(() => ({ moves: [...window.pokecraft.party[0].moves], learned: window.pokecraft.party[0].learned }));
    const slot = before.findIndex(m => after.moves[before.indexOf(m)] !== m);
    t.ok(after.moves.length === 4 && after.moves[slot] === 'grumble' && !after.moves.includes(before[slot]),
      `${label}: forgetting ${forget} puts Grumble in the same slot (${after.moves.join(', ')})`);
  } else {
    await press('#b-actions button:has-text("Don\'t learn")');
    await page.waitForFunction(() => window.pokecraft.battle.history.some(h => h.includes('did not learn')), null, { timeout: 30000 });
    const after = await page.evaluate(() => ({ moves: [...window.pokecraft.party[0].moves], learned: window.pokecraft.party[0].learned }));
    t.ok(JSON.stringify(after.moves) === JSON.stringify(before) && after.learned.includes('grumble'),
      `${label}: "Don't learn" keeps the moves, and Grumble counts as offered`);
  }
  if (!tap) await playBattle(page); else {
    for (let i = 0; i < 40 && await page.evaluate(() => window.pokecraft.inBattle); i++) await page.waitForTimeout(700);
  }
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), `${label}: the battle finishes`);
}

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);

  // 1. Data.
  const data = await page.evaluate(async (reserved) => {
    const S = await import('/src/species.js');
    const KINDS = ['heal', 'raise', 'lower', 'flinch', 'sleep', 'multi', 'recoil', 'rally', 'shield', 'risky', 'sacrifice', 'curse', 'field', 'lastword'];
    const types = ['normal', ...Object.keys(S.TYPE_COLORS)];
    const out = { few: [], bad: [], dupNames: [], clash: [], unknownLearn: [], firstNotDamage: [], noCoverage: [], hits: 0, total: Object.keys(S.MOVES).length };
    for (const type of types) {
      const n = Object.values(S.MOVES).filter(m => m.type === type && !m.sig).length;
      if (n < (type === 'normal' ? 8 : 4)) out.few.push(`${type}:${n}`);
    }
    const names = new Set();
    for (const [id, m] of Object.entries(S.MOVES)) {
      if (!m.name || !types.includes(m.type) || typeof m.power !== 'number' || typeof m.acc !== 'number' || (m.fx && !KINDS.includes(m.fx.kind))) out.bad.push(id);
      if (names.has(m.name)) out.dupNames.push(m.name);
      names.add(m.name);
      if (reserved.includes(id)) out.clash.push(id);
      if (!m.power && !m.fx) out.bad.push(id + ' (does nothing)');
    }
    for (const [id, sp] of Object.entries(S.SPECIES)) {
      for (const [, m] of sp.learn) if (!S.MOVES[m]) out.unknownLearn.push(`${id}:${m}`);
      for (let lv = 1; lv <= 60; lv++) {
        const c = S.makeCreature(id, lv);
        if (!(S.MOVES[c.moves[0]]?.power > 0)) out.firstNotDamage.push(`${id}@${lv}`);
      }
      if (!sp.legendary) {
        const c = S.makeCreature(id, 30);
        if (!c.moves.some(m => S.MOVES[m].type !== sp.type && S.MOVES[m].type !== 'normal')) out.noCoverage.push(id);
      }
    }
    out.info = S.moveInfo('flarekick').text + ' / ' + S.moveInfo('lullaby').text;
    return out;
  }, RESERVED_SOUNDS);
  t.ok(data.total >= 138 && !data.few.length, `every type has enough moves (${data.total} moves) ${data.few.join(', ')}`);
  t.ok(!data.bad.length && !data.dupNames.length && !data.clash.length, `moves are well formed, names unique, no sound clash ${[...data.bad, ...data.dupNames, ...data.clash].join(', ')}`);
  t.ok(!data.unknownLearn.length, `every learnset move exists ${data.unknownLearn.join(', ')}`);
  t.ok(!data.firstNotDamage.length, `the first move is always a damaging move, levels 1 to 60 ${data.firstNotDamage.slice(0, 5).join(', ')}`);
  t.ok(!data.noCoverage.length, `every creature knows a move of another type at Lv 30 ${data.noCoverage.join(', ')}`);
  t.ok(data.info === 'power 60 · may make the foe flinch / puts the foe to sleep', `moveInfo words (${data.info})`);

  // 2. Effects, driving the battle object directly with scripted random numbers.
  const fx = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const g = window.pokecraft;
    const b = g.battle;
    const R = {};
    const make = (allySp, foeSp, allyMoves, foeMoves, lv = 30, foeLv = 40) => {
      const log = [];
      b.say = async text => { log.push(text); };
      b.lunge = async () => {}; b.flash = async () => {}; b.refresh = () => {};
      b.allies = [S.makeCreature(allySp, lv, allyMoves)];
      b.foes = [S.makeCreature(foeSp, foeLv, foeMoves)];
      b.allyIdx = b.foeIdx = 0;
      b.trainer = b.duel = null; b.boss = false; b.modMap = new Map(); b.resetSides();
      return log;
    };
    const seq = list => { const s = { n: 0 }; b.rng = () => { s.n++; return list.length ? list.shift() : 0.5; }; return s; };
    const dropOf = async (side, move, rolls, first = false) => {
      const foe = side === 'ally' ? b.foe : b.ally;
      const h = foe.hp; const s = seq(rolls);
      await b.useMove(side, move, { first });
      return { drop: h - foe.hp, draws: s.n };
    };

    // heal
    let log = make('fluffin', 'woolumph', ['restup']);
    b.ally.hp = 10; let s = seq([0.1]);
    await b.useMove('ally', 'restup');
    R.heal = { hp: b.ally.hp, want: 10 + Math.floor(S.statsFor(b.ally).maxHp / 2), log: log.join('|'), draws: s.n };
    // raise (Pump Up), and Bump hits harder afterwards
    log = make('fluffin', 'woolumph', ['pumpup', 'tackle']);
    const d1 = await dropOf('ally', 'tackle', [0.1, 0.5, 0.5]);
    b.foe.hp = S.statsFor(b.foe).maxHp;
    seq([0.1]); await b.useMove('ally', 'pumpup');
    const mAtk = b.mods(b.ally).atk;
    b.foe.hp = S.statsFor(b.foe).maxHp;
    const d2 = await dropOf('ally', 'tackle', [0.1, 0.5, 0.5]);
    R.raise = { atk: mAtk, d1: d1.drop, d2: d2.drop };
    // lower attack (Grumble)
    log = make('fluffin', 'woolumph', ['grumble']);
    seq([0.1]); await b.useMove('ally', 'grumble');
    R.grumble = { atk: b.mods(b.foe).atk, log: log.join('|') };
    // lower speed with a chance (Chill Wind)
    log = make('frostling', 'woolumph', ['chillwind']);
    const spd0 = b.speedOf(b.foe);
    await dropOf('ally', 'chillwind', [0.1, 0.5, 0.5, 0.1]);
    const slowed = { spd: b.mods(b.foe).spd, now: b.speedOf(b.foe), before: spd0 };
    log = make('frostling', 'woolumph', ['chillwind']);
    await dropOf('ally', 'chillwind', [0.1, 0.5, 0.5, 0.9]);
    R.chill = { slowed, unlucky: b.mods(b.foe).spd };
    // flinch (Flare Kick) only when moving first
    log = make('emberpup', 'woolumph', ['flarekick'], ['tackle'], 20);
    await dropOf('ally', 'flarekick', [0.1, 0.5, 0.5, 0], true);
    const flinchSet = b.mods(b.foe).flinch;
    const hpA = b.ally.hp; s = seq([]);
    await b.useMove('foe', 'tackle');
    R.flinch = { set: flinchSet, draws: s.n, hurt: hpA - b.ally.hp, log: log.join('|'), cleared: !b.mods(b.foe).flinch };
    log = make('emberpup', 'woolumph', ['flarekick'], ['tackle'], 20);
    await dropOf('ally', 'flarekick', [0.1, 0.5, 0.5, 0], false);
    R.noFlinch = b.mods(b.foe).flinch;
    // sleep (Lullaby): 2 turns lost, then a free turn
    log = make('echobat', 'woolumph', ['lullaby'], ['tackle'], 20);
    s = seq([0.1, 0.2]); await b.useMove('ally', 'lullaby');
    const asleep = b.mods(b.foe).sleep, sleepDraws = s.n;
    const hp1 = b.ally.hp; s = seq([]);
    await b.useMove('foe', 'tackle');
    const skipped1 = { hurt: hp1 - b.ally.hp, draws: s.n, sleep: b.mods(b.foe).sleep };
    await b.useMove('foe', 'tackle');
    const skipped2 = { hurt: hp1 - b.ally.hp, draws: s.n, sleep: b.mods(b.foe).sleep, justWoke: b.mods(b.foe).justWoke };
    s = seq([0.1, 0.5, 0.5]); await b.useMove('foe', 'tackle');
    R.sleep = { asleep, sleepDraws, skipped1, skipped2, then: hp1 - b.ally.hp, draws: s.n, log: log.join('|'), cleared: !b.mods(b.foe).justWoke };
    // a long sleep: 3 turns lost
    make('echobat', 'woolumph', ['lullaby'], ['tackle'], 20);
    seq([0.1, 0.7]); await b.useMove('ally', 'lullaby');
    const three = b.mods(b.foe).sleep;
    const hp3 = b.ally.hp; seq([]);
    for (let i = 0; i < 3; i++) await b.useMove('foe', 'tackle');
    const lost3 = hp3 - b.ally.hp;
    seq([0.1, 0.5, 0.5]); await b.useMove('foe', 'tackle');
    R.sleep3 = { three, lost3, then: hp3 - b.ally.hp };
    // +25% damage while asleep
    make('sproutle', 'woolumph', ['tackle'], null, 30);
    const awake = await dropOf('ally', 'tackle', [0.1, 0.5, 0.5]);
    make('sproutle', 'woolumph', ['tackle'], null, 30);
    b.mods(b.foe).sleep = 2;
    const asleepHit = await dropOf('ally', 'tackle', [0.1, 0.5, 0.5]);
    R.plus25 = { awake: awake.drop, asleep: asleepHit.drop };
    // the 3rd hit of a multi-hit move wakes a sleeper
    make('sproutle', 'woolumph', ['seedvolley'], null, 30);
    const one = await dropOf('ally', 'seedvolley', [0.1, 0, 0.5, 0.5]); // 1 hit, awake
    make('sproutle', 'woolumph', ['seedvolley'], null, 30);
    b.mods(b.foe).sleep = 3;
    const oneAsleep = await dropOf('ally', 'seedvolley', [0.1, 0, 0.5, 0.5]);
    log = make('sproutle', 'woolumph', ['seedvolley'], null, 30);
    b.mods(b.foe).sleep = 3;
    const five = await dropOf('ally', 'seedvolley', [0.1, 0.99, 0.5, 0.5]);
    const fiveMods = { sleep: b.mods(b.foe).sleep, justWoke: b.mods(b.foe).justWoke };
    const fiveLog = log.join('|');
    log = make('sproutle', 'woolumph', ['seedvolley'], null, 30);
    b.mods(b.foe).sleep = 3;
    await dropOf('ally', 'seedvolley', [0.1, 0.2, 0.5, 0.5]); // 2 hits
    const twoMods = { sleep: b.mods(b.foe).sleep, log: log.join('|') };
    make('sproutle', 'woolumph', ['thousandcranes'], null, 30);
    b.mods(b.foe).sleep = 3;
    await dropOf('ally', 'thousandcranes', [0.1, 0, 0.5, 0.5]); // 3 hits
    const cranes = { sleep: b.mods(b.foe).sleep, justWoke: b.mods(b.foe).justWoke };
    R.wake = { one: one.drop, oneAsleep: oneAsleep.drop, five: five.drop, fiveMods, fiveDraws: five.draws, fiveLog, twoMods, cranes };
    // free turn: Lullaby fails right after waking; a Big Bong proc does damage but no sleep
    log = make('echobat', 'woolumph', ['lullaby', 'bigbong', 'tackle'], null, 20);
    b.mods(b.foe).justWoke = true;
    s = seq([0.1, 0.2]); await b.useMove('ally', 'lullaby');
    const failed = { sleep: b.mods(b.foe).sleep, draws: s.n, log: log.join('|') };
    log.length = 0;
    const bb = await dropOf('ally', 'bigbong', [0.1, 0.5, 0.5, 0.0, 0.5]);
    const quiet = { drop: bb.drop, sleep: b.mods(b.foe).sleep, log: log.join('|') };
    b.mods(b.foe).justWoke = false; // after the foe has made a move
    seq([0.1, 0.2]); await b.useMove('ally', 'lullaby');
    R.free = { failed, quiet, again: b.mods(b.foe).sleep };
    // catch chance is higher asleep
    make('sproutle', 'woolumph', ['tackle'], null, 30);
    const cAwake = b.catchChance();
    b.mods(b.foe).sleep = 2;
    R.catch = { awake: cAwake, asleep: b.catchChance() };
    // multi-hit (Seed Volley)
    log = make('sproutle', 'woolumph', ['seedvolley'], null, 20);
    const four = await dropOf('ally', 'seedvolley', [0.1, 0.8, 0.5, 0.5]);
    const fourLog = log.join('|');
    make('sproutle', 'woolumph', ['seedvolley'], null, 20);
    const two = await dropOf('ally', 'seedvolley', [0.1, 0.2, 0.5, 0.5]);
    R.multi = { four: four.drop, two: two.drop, draws: four.draws, log: fourLog };
    // recoil (Inferno Dash)
    make('emberpup', 'woolumph', ['infernodash'], null, 30);
    const hpR = b.ally.hp;
    await dropOf('ally', 'infernodash', [0.1, 0.5, 0.5]);
    const lost = hpR - b.ally.hp;
    make('emberpup', 'woolumph', ['infernodash'], null, 30);
    b.ally.hp = 1;
    await dropOf('ally', 'infernodash', [0.1, 0.5, 0.5]);
    R.recoil = { lost, left: b.ally.hp };
    // never misses
    make('thinkit', 'woolumph', ['mindtrick'], null, 30);
    const sure = await dropOf('ally', 'mindtrick', [0.999, 0.5, 0.5]);
    log = make('emberpup', 'woolumph', ['flameburst'], null, 30);
    const miss = await dropOf('ally', 'flameburst', [0.95, 0.5, 0.5]);
    R.sure = { sure: sure.drop, miss: miss.drop, log: log.join('|') };
    // cap at +3
    log = make('fluffin', 'woolumph', ['pumpup']);
    for (let i = 0; i < 4; i++) { seq([0.1]); await b.useMove('ally', 'pumpup'); }
    R.cap = { atk: b.mods(b.ally).atk, log: log.join('|') };
    // how many random numbers each kind of move uses
    make('fluffin', 'woolumph', ['restup', 'tackle', 'seedvolley', 'flarekick', 'infernodash', 'bigbong', 'lullaby']);
    const count = async (id, rolls) => { b.foe.hp = S.statsFor(b.foe).maxHp; const s = seq(rolls); await b.useMove('ally', id); return s.n; };
    R.draws = {
      status: await count('restup', [0.1]), plain: await count('tackle', [0.1, 0.5, 0.5]),
      multi: await count('seedvolley', [0.1, 0.5, 0.5, 0.5]), chance: await count('flarekick', [0.1, 0.5, 0.5, 0.5]),
      recoil: await count('infernodash', [0.1, 0.5, 0.5]), sureMove: await count('mindtrick', [0.1, 0.5, 0.5]),
      sleepMove: await count('lullaby', [0.1, 0.5]), chanceSleep: await count('bigbong', [0.1, 0.5, 0.5, 0.0, 0.5]),
      chanceSleepMiss: await count('bigbong', [0.1, 0.5, 0.5, 0.9]),
    };
    // determinism: the same scripted battle with the same seed ends the same way
    const { mulberry32 } = await import('/src/blocks.js');
    const run = async () => {
      const log = make('echobat', 'frostling', ['lullaby', 'shriek', 'restup', 'bassblast'], ['chillwind', 'tackle', 'seedvolley', 'grumble'], 30, 30);
      b.rng = mulberry32(123);
      const script = [['ally', 'shriek', 1], ['foe', 'chillwind', 0], ['ally', 'lullaby', 1], ['foe', 'tackle', 0], ['foe', 'tackle', 0], ['ally', 'bassblast', 1],
        ['foe', 'grumble', 1], ['ally', 'restup', 0], ['foe', 'seedvolley', 1], ['ally', 'shriek', 0]];
      for (const [side, move, first] of script) await b.useMove(side, move, { first: !!first });
      return JSON.stringify({ a: b.ally.hp, f: b.foe.hp, ma: b.mods(b.ally), mf: b.mods(b.foe), log });
    };
    const r1 = await run(), r2 = await run();
    // mirror: same seed, sides swapped -> swapped results, same log length and rng call count
    const mirror = async swap => {
      const mine = ['lullaby', 'shriek', 'restup', 'bassblast'], theirs = ['chillwind', 'tackle', 'seedvolley', 'grumble'];
      const log = make(swap ? 'frostling' : 'echobat', swap ? 'echobat' : 'frostling', swap ? theirs : mine, swap ? mine : theirs, 30, 30);
      const rng = mulberry32(99); let calls = 0; b.rng = () => { calls++; return rng(); };
      const A = swap ? 'foe' : 'ally', F = swap ? 'ally' : 'foe';
      const sc = [[A, 'lullaby', 1], [F, 'tackle', 0], [F, 'tackle', 0], [F, 'tackle', 0], [A, 'bassblast', 1], [F, 'seedvolley', 1], [A, 'restup', 0], [F, 'grumble', 1], [A, 'shriek', 0]];
      for (const [side, move, first] of sc) await b.useMove(side, move, { first: !!first });
      const sleeper = swap ? b.ally : b.foe, caster = swap ? b.foe : b.ally;
      const { sleep, justWoke } = b.mods(sleeper);
      return { sleeper: sleeper.hp, caster: caster.hp, sleep, justWoke, n: log.length, calls };
    };
    const m1 = await mirror(false), m2 = await mirror(true);
    R.mirror = { same: JSON.stringify(m1) === JSON.stringify(m2), m1, m2 };
    R.deterministic = { same: r1 === r2, long: r1.length > 300 };
    // the foe's choices
    make('fluffin', 'woolumph', null, ['restup', 'tackle', 'bubble'], 30, 40);
    b.foe.hp = Math.floor(S.statsFor(b.foe).maxHp * 0.3);
    let picks = 0;
    for (let i = 0; i < 20; i++) if (b.pickFoeMove() === 'restup') picks++;
    b.mods(b.foe).healed = 1;
    let again = 0;
    for (let i = 0; i < 20; i++) if (b.pickFoeMove() === 'restup') again++;
    make('fluffin', 'woolumph', null, ['lullaby', 'tackle'], 30, 40);
    b.mods(b.ally).sleep = 2;
    let lulls = 0;
    for (let i = 0; i < 40; i++) if (b.pickFoeMove() === 'lullaby') lulls++;
    b.mods(b.ally).sleep = 0; b.mods(b.ally).justWoke = true;
    let lulls2 = 0;
    for (let i = 0; i < 40; i++) if (b.pickFoeMove() === 'lullaby') lulls2++;
    R.ai = { picks, again, lulls, lulls2 };
    // multiHits table
    const H = S.multiHits, W = S.MOVES.seedvolley.fx;
    R.table = { rs: [0.05, 0.2, 0.5, 0.8, 0.95].map(r => H(W, r)), cranes: [H(S.MOVES.thousandcranes.fx, 0), H(S.MOVES.thousandcranes.fx, 0.99)],
      ids: ['seedvolley', 'rivetshot', 'meteorshower', 'bonetoss', 'confetti', 'rapidclick', 'pillowfight', 'gemtoss'].every(id => S.MOVES[id].fx.weights && S.MOVES[id].fx.min === 1 && S.MOVES[id].fx.max === 5),
      cranesPlain: !S.MOVES.thousandcranes.fx.weights, note: S.moveInfo('lullaby').note.length > 0 };
    const rr = mulberry32(7), counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 20000; i++) counts[H(W, rr()) - 1]++;
    R.table.freq = counts.map(n => n / 20000);
    // old save: a Lv 30 creature without a "learned" list gets exactly one new move offered per level
    const old = S.makeCreature('blazehound', 30);
    delete old.learned;
    old.moves = ['tackle', 'ember', 'quickjab', 'flameburst'];
    old.xp = S.xpForLevel(31) - 1;
    const res = S.gainXp(old, 5, { ask: true });
    const offers = res.msgs.filter(m => m.learn);
    R.catchup = { level: old.level, offers: offers.map(o => o.learn) };
    return R;
  });
  t.ok(fx.heal.hp === fx.heal.want && fx.heal.log.includes('got some HP back') && fx.heal.draws === 1, `heal: Rest Up gives back half (${fx.heal.hp} = ${fx.heal.want})`);
  t.ok(fx.raise.atk === 1 && fx.raise.d2 > fx.raise.d1, `raise: Pump Up makes Bump hit harder (${fx.raise.d1} -> ${fx.raise.d2}, atk ${fx.raise.atk})`);
  t.ok(fx.grumble.atk === -1 && fx.grumble.log.includes('attack went down'), 'lower attack: Grumble');
  t.ok(fx.chill.slowed.spd === -1 && fx.chill.slowed.now < fx.chill.slowed.before && fx.chill.unlucky === 0,
    `lower speed: Chill Wind slows on a good roll only (${JSON.stringify(fx.chill)})`);
  t.ok(fx.flinch.set && fx.flinch.draws === 0 && fx.flinch.hurt === 0 && fx.flinch.log.includes('flinched') && fx.flinch.cleared && !fx.noFlinch,
    `flinch: only when moving first, and the foe loses its move (${JSON.stringify(fx.flinch)})`);
  const sl = fx.sleep;
  t.ok(sl.asleep === 2 && sl.sleepDraws === 2 && sl.skipped1.hurt === 0 && sl.skipped1.draws === 0 && sl.skipped1.sleep === 1
    && sl.skipped2.hurt === 0 && sl.skipped2.sleep === 0 && sl.skipped2.justWoke && sl.then > 0 && sl.cleared
    && sl.log.includes('fell asleep') && sl.log.includes('fast asleep') && sl.log.includes('woke up'),
    `sleep: Lullaby skips exactly 2 moves, then a free turn (${sl.log})`);
  t.ok(fx.sleep3.three === 3 && fx.sleep3.lost3 === 0 && fx.sleep3.then > 0, `sleep: a roll of 0.7 means 3 lost moves (${JSON.stringify(fx.sleep3)})`);
  t.ok(Math.abs(fx.plus25.asleep - fx.plus25.awake * 1.25) <= 1 && fx.plus25.asleep > fx.plus25.awake, `a sleeper takes 25% more (${fx.plus25.awake} -> ${fx.plus25.asleep})`);
  const wk = fx.wake;
  t.ok(wk.five === 3 * wk.oneAsleep + 2 * wk.one && wk.fiveMods.sleep === 0 && wk.fiveMods.justWoke && wk.fiveLog.includes('woke') && wk.fiveDraws === 4,
    `wake-up hit: 5 hits on a sleeper = 3 hurt more + 2 normal, then awake with a free turn (${JSON.stringify(wk)})`);
  t.ok(wk.twoMods.sleep === 3 && !wk.twoMods.log.includes('woke'), 'two hits leave a sleeper asleep');
  t.ok(wk.cranes.sleep === 0 && wk.cranes.justWoke, 'Thousand Cranes (3 hits) wakes a sleeper');
  t.ok(fx.free.failed.sleep === 0 && fx.free.failed.draws === 2 && fx.free.failed.log.includes('wide awake')
    && fx.free.quiet.drop > 0 && fx.free.quiet.sleep === 0 && !fx.free.quiet.log.includes('wide awake') && fx.free.again > 0,
    `free turn: no new sleep right after waking, Big Bong stays quiet (${JSON.stringify(fx.free)})`);
  t.ok(fx.catch.asleep > fx.catch.awake, `catchChance is higher asleep (${fx.catch.awake} -> ${fx.catch.asleep})`);
  const tb = fx.table;
  t.ok(JSON.stringify(tb.rs) === '[1,2,3,4,5]' && tb.cranes[0] === 3 && tb.cranes[1] === 5 && tb.ids && tb.cranesPlain && tb.note, `multiHits table (${JSON.stringify(tb)})`);
  t.ok([0.1, 0.3, 0.3, 0.2, 0.1].every((w, i) => Math.abs(tb.freq[i] - w) <= 0.02), `hit counts follow the weights (${tb.freq.join(', ')})`);
  t.ok(fx.multi.log.includes('Hit 4 times!') && fx.multi.four === fx.multi.two * 2 && fx.multi.four > 0 && fx.multi.draws === 4,
    `multi-hit: Seed Volley, 4 hits = 2 x 2 hits (${fx.multi.four} / ${fx.multi.two})`);
  t.ok(fx.recoil.lost > 0 && fx.recoil.left === 1, `recoil: Inferno Dash hurts the user but never knocks it out (lost ${fx.recoil.lost}, left ${fx.recoil.left})`);
  t.ok(fx.sure.sure > 0 && fx.sure.miss === 0 && fx.sure.log.includes('missed'), `never miss: Mind Trick hits on a bad roll, Blaze Burst misses`);
  t.ok(fx.cap.atk === 3 && fx.cap.log.endsWith("can't go any higher!"), `stat steps stop at 3 (${fx.cap.log.split('|').pop()})`);
  t.ok(JSON.stringify(fx.draws) === JSON.stringify({ status: 1, plain: 3, multi: 4, chance: 4, recoil: 3, sureMove: 3, sleepMove: 2, chanceSleep: 5, chanceSleepMiss: 4 }),
    `random numbers drawn per move kind (${JSON.stringify(fx.draws)})`);
  t.ok(fx.mirror.same, `mirror run: sides swapped give the same battle (${JSON.stringify(fx.mirror)})`);
  t.ok(fx.deterministic.same && fx.deterministic.long, 'the same seed and the same moves always give the same battle');
  t.ok(fx.ai.picks >= 1 && fx.ai.again === 0 && fx.ai.lulls === 0 && fx.ai.lulls2 === 0, `foe AI: heals when low (once only), never puts a sleeper (or one just woken) to sleep (${JSON.stringify(fx.ai)})`);
  t.ok(fx.catchup.level === 31 && fx.catchup.offers.length === 1 && !['tackle', 'ember', 'quickjab', 'flameburst', 'bodyslam'].includes(fx.catchup.offers[0]),
    `old saves: one new move offered per level (${JSON.stringify(fx.catchup)})`);

  // 3. Move buttons and a log line for an effect (screenshots), with the mouse.
  await platform(page);
  await pause(page);
  await page.evaluate(() => { const b = window.pokecraft.battle; for (const k of ['say', 'lunge', 'flash', 'refresh']) delete b[k]; });
  await startWeakBattle(page, { species: 'echobat', level: 24, moves: ['lullaby', 'shriek', 'restup', 'bassblast'] });
  await page.waitForSelector('#b-actions button:not([disabled])', { timeout: 60000 });
  await page.evaluate(() => { window.pokecraft.battle.rng = () => 0.1; }); // never misses, effects always happen
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'moves-buttons.png') });
  const labels = await page.evaluate(() => [...document.querySelectorAll('#b-actions button small')].map(s => s.textContent));
  t.ok(labels.some(l => l.includes('puts the foe to sleep')) && labels.some(l => l.includes('heals you')) && labels.some(l => l.includes('power 75')),
    `move buttons show what each move does (${labels.join(' | ')})`);
  await click(page, '#b-actions button >> nth=0'); // Lullaby
  const zzz = await page.waitForSelector('#b-wild .b-tags .zzz', { timeout: 60000 }).then(() => true, () => false);
  t.ok(zzz, 'the sleeping creature shows a Zzz tag');
  await page.screenshot({ path: path.join(SHOTS, 'moves-log-effect.png') });
  await playBattle(page);

  // 4. The Book lists the effects.
  await page.evaluate(() => { const b = window.pokecraft.book; b.markCaught('gongolin'); b.open(); b.showDetail('gongolin'); });
  await page.waitForTimeout(800);
  const bookText = await page.evaluate(() => document.querySelector('.book-moves')?.textContent || '');
  t.ok(bookText.includes('★ Big Bong') && bookText.includes('may put the foe to sleep') && bookText.includes('hits 1 to 5 times'), `the Book shows effects and the special move (${bookText.slice(0, 100)})`);
  await page.evaluate(() => document.querySelector('.book-moves')?.scrollIntoView());
  await page.screenshot({ path: path.join(SHOTS, 'moves-book.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 5. Forget prompt with the mouse: pick a move, then (new battle) say no.
  await platform(page);
  await pause(page);
  await forgetPrompt(page, t, { tap: false, label: 'mouse', shot: 'moves-forget-desktop.png', forget: 'Quick Jab' });
  await forgetPrompt(page, t, { tap: false, label: 'mouse (no)', shot: 'moves-forget-desktop-no.png', forget: null });
  // The declined move is not offered again on the next level-ups (until a new move comes at Lv 28).
  const again = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const c = window.pokecraft.party[0];
    return S.gainXp(c, S.xpForLevel(27) - c.xp, { ask: true }).msgs.filter(m => m.learn).map(m => m.learn);
  });
  // (the big move staticfuzz arrives at Lv 24, which is new; nothing the player already said no to comes back)
  t.ok(again.join(',') === 'staticfuzz', `a move you said no to is not offered again, only the new big move (${again.join(',')})`);
  t.ok(!page.errors.length, `no page errors (desktop) ${page.errors.join('; ')}`);
  await page.context().close();

  // 6. The same prompt on an iPad, with taps.
  const ipad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await ipad.tap('text=New Game');
  await ipad.tap('.starter >> nth=0');
  await ipad.waitForTimeout(1500);
  await platform(ipad);
  await forgetPrompt(ipad, t, { tap: true, label: 'iPad', shot: 'moves-forget-ipad.png', forget: 'Quick Jab' });
  await startWeakBattle(ipad, { species: 'echobat', level: 24, moves: ['lullaby', 'shriek', 'restup', 'bassblast'] });
  await ipad.waitForSelector('#b-actions button:not([disabled])', { timeout: 60000 });
  await ipad.waitForTimeout(400);
  await ipad.screenshot({ path: path.join(SHOTS, 'moves-buttons-ipad.png') });
  t.ok(!ipad.errors.length, `no page errors (iPad) ${ipad.errors.join('; ')}`);
  await ipad.context().close();
}
