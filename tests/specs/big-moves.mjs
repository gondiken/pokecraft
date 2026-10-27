// T25 big-decision moves: the 61 moves (data), each kind's rules with scripted random numbers,
// the foe's choices, a mirror run (duel safety), the leaders' moves and rematches, the real battle
// buttons (screenshots) and a real duel between two browsers.
import fs from 'node:fs';
import path from 'node:path';
import { PENDING } from '../pending-types.mjs'; // T40 base
import { openGame, openPair, newGame, click, pause, platform, startWeakBattle, playBattle, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
// Big moves added by wave 11 (each task adds its own key, kinds -> how many): the T25 numbers below stay as they were.
const WAVE11_BIG = { squad: { rally: 1, shield: 1, sacrifice: 1 } }; // T34
const ADD = {};
for (const k of Object.values(WAVE11_BIG)) for (const [kind, n] of Object.entries(k)) ADD[kind] = (ADD[kind] || 0) + n;
const ADD_TOTAL = Object.values(ADD).reduce((a, b) => a + b, 0);

// A wild battle against a level-2 Fluffin with 1 HP (like startWeakBattle) with a chosen lead and HP.
const startUi = (page, { species, level, moves }) => page.evaluate(async ({ species, level, moves }) => {
  const g = window.pokecraft;
  const S = await import('/src/species.js');
  const { Wild } = await import('/src/creatures.js');
  g.party = [S.makeCreature(species, level, moves)];
  const wild = new Wild(S.makeCreature('fluffin', 2), S.buildModel('fluffin'), g.player.pos.clone().setX(g.player.pos.x + 3));
  wild.data.hp = 1;
  g.creatures.list.push(wild);
  g.scene.add(wild.model);
  wild.model.position.copy(wild.pos);
  g.inBattle = true; document.body.classList.add('in-battle');
  document.getElementById('pause').classList.add('hidden');
  g.battle.start({ wild });
}, { species, level, moves });

const buttons = page => page.evaluate(() => [...document.querySelectorAll('#b-actions button')].map(b => ({
  label: b.firstChild.textContent, sub: b.querySelector('small')?.textContent || '', disabled: b.disabled,
})));
const press = (page, label) => page.evaluate(label => {
  const b = [...document.querySelectorAll('#b-actions button:not([disabled])')].find(b => b.firstChild.textContent === label);
  b?.click();
  return !!b;
}, label);
const ready = page => page.waitForFunction(() => document.querySelector('#b-actions button:not([disabled])'), null, { timeout: 90000, polling: 100 });

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);

  const R = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const { mulberry32 } = await import('/src/blocks.js');
    const g = window.pokecraft;
    const b = g.battle;
    const R = {};
    // --- helpers ---
    const team = list => list.map(([sp, lv, mv]) => S.makeCreature(sp, lv, mv));
    const make = (allyList, foeList, trainer = null) => {
      const log = [];
      b.say = async text => { log.push(text); };
      b.lunge = async () => {}; b.flash = async () => {}; b.refresh = () => {};
      b.allies = team(allyList); b.foes = team(foeList);
      b.allyIdx = b.foeIdx = 0;
      b.trainer = trainer; b.duel = null; b.boss = false; b.modMap = new Map(); b.resetSides();
      return log;
    };
    const seq = list => { const s = { n: 0 }; b.rng = () => { s.n++; return list.length ? list.shift() : 0.5; }; return s; };
    // hp lost by the other side's active creature
    const dropOf = async (side, move, rolls) => {
      const other = side === 'ally' ? b.foe : b.ally;
      const h = other.hp; const s = seq(rolls);
      await b.useMove(side, move, { first: false });
      return { drop: h - other.hp, draws: s.n };
    };
    const arrive = async (side, i) => {
      if (side === 'ally') b.allyIdx = i; else b.foeIdx = i;
      b.modMap.delete(side === 'ally' ? b.ally : b.foe);
      await b.giftArrives(side);
    };
    const maxOf = c => S.statsFor(c).maxHp;
    const F = (sp, lv, mv) => [sp, lv, mv];

    // 1. data
    const big = Object.entries(S.MOVES).filter(([, m]) => m.big);
    const counts = {};
    for (const [, m] of big) counts[m.fx.kind] = (counts[m.fx.kind] || 0) + 1;
    const perType = {};
    for (const [, m] of big) perType[m.type] = (perType[m.type] || 0) + 1;
    const names = new Set(big.map(([, m]) => m.name));
    const learnBad = [], autoBad = [];
    for (const [id, sp] of Object.entries(S.SPECIES)) {
      if (sp.legendary) continue;
      const mine = big.filter(([, m]) => m.type === sp.type);
      for (const [mid, m] of mine) {
        const row = sp.learn.find(([, x]) => x === mid);
        if (!row || row[0] !== S.BIG_LEVEL[m.fx.kind]) learnBad.push(`${id}:${mid}`);
      }
      if (sp.learn.some(([, x]) => S.MOVES[x].big && S.MOVES[x].type !== sp.type)) learnBad.push(`${id}:other-type`);
      for (const lv of [1, 20, 21, 34, 45, 60]) {
        const c = S.makeCreature(id, lv);
        if (c.moves.some(S.isBig) || c.learned.some(S.isBig)) autoBad.push(`${id}@${lv}`);
      }
    }
    // gainXp offers big moves (Lv 33 -> 35 for a normal creature: lastword at 34; older shield 21 and rally 22 are caught up)
    const c33 = S.makeCreature('fluffin', 33);
    c33.xp = S.xpForLevel(34) - 1;
    const offered = [];
    for (let i = 0; i < 3; i++) {
      const res = S.gainXp(c33, c33.level < 35 ? S.xpForLevel(c33.level + 1) - c33.xp : 0, { ask: true });
      for (const m of res.msgs.filter(m => m.learn)) { offered.push(m.learn); c33.learned.push(m.learn); } // askForget records it
    }
    const sw = S.autoMoves('fluffin', 40), mw = S.movesWith('fluffin', 40, 'goteamgo', 'standtogether');
    R.data = {
      total: big.length, counts, types: Object.keys(perType).length, minPer: Math.min(...Object.values(perType)), maxPer: Math.max(...Object.values(perType)),
      flags: big.every(([, m]) => !m.sig && m.fx.chance === undefined), uniqueNames: names.size === big.length, learnBad, autoBad, offered,
      swBig: sw.some(S.isBig), mw, mwOk: mw.length === 4 && mw.includes('goteamgo') && mw.includes('standtogether') && S.MOVES[mw[0]].power > 0,
      kinds: S.BIG_KINDS.join(','), lastwordPower: S.MOVES.nevergiveup.power, riskyPower: S.MOVES.wildblaze.power,
      info: Object.fromEntries(['goteamgo', 'standtogether', 'wildblaze', 'wavegoodbye', 'staticfuzz', 'hightide', 'nevergiveup'].map(id => [id, S.moveInfo(id)])),
    };
    const { sound } = await import('/src/sound.js');
    R.data.soundClash = big.filter(([id]) => sound.has(id)).map(([id]) => id);

    // 2. rally
    let log = make([F('fluffin', 30, ['goteamgo', 'tackle']), F('woolumph', 30, ['tackle'])], [F('woolumph', 40, ['tackle'])]);
    b.round = 1;
    let s = seq([0.1]);
    await b.useMove('ally', 'goteamgo');
    const a0 = { atk: b.mods(b.ally).atk, def: b.mods(b.ally).def, team: b.sides.ally.atk, draws: s.n, log: log.join('|') };
    await arrive('ally', 1);
    const benchAtk = b.mods(b.ally).atk;
    await arrive('ally', 0);
    b.modMap.set(b.ally, { ...b.mods(b.ally), atk: 1 }); // the first one is back in with the team's step
    seq([0.1]); await b.useMove('ally', 'goteamgo');
    const second = { atk: b.mods(b.ally).atk, team: b.sides.ally.atk };
    b.mods(b.ally).atk = 3; b.sides.ally.atk = 3; const defBefore = b.mods(b.ally).def;
    log.length = 0; seq([0.1]); await b.useMove('ally', 'goteamgo');
    R.rally = { a0, benchAtk, second, cap: { def: b.mods(b.ally).def === defBefore, log: log.join('|') } };

    // 3. shield
    make([F('fluffin', 30, ['standtogether', 'tackle']), F('woolumph', 30, ['tackle'])], [F('woolumph', 40, ['tackle'])]);
    b.round = 1;
    const plain = await dropOf('foe', 'tackle', [0.1, 0.5, 0.5]);
    b.ally.hp = maxOf(b.ally);
    s = seq([0.1]); await b.useMove('ally', 'standtogether');
    const shieldDraws = s.n;
    const restSet = b.mods(b.ally).rest;
    const shielded = await dropOf('foe', 'tackle', [0.1, 0.5, 0.5]);
    log = []; b.say = async x => { log.push(x); };
    const hpR = b.foe.hp; s = seq([]);
    await b.useMove('ally', 'tackle');
    const rested = { draws: s.n, log: log.join('|'), hurt: hpR - b.foe.hp, flag: b.mods(b.ally).rest };
    await arrive('ally', 1);
    const benchShield = await dropOf('foe', 'tackle', [0.1, 0.5, 0.5]);
    const benchPlainRef = plain.drop; // same level 30 woolumph differs in defence, so only check it is reduced vs the unshielded same creature below
    b.round = b.sides.ally.shield.until; const stillOn = b.shieldOn('ally');
    b.round = b.sides.ally.shield.until + 1; log.length = 0;
    await b.tickEffects();
    const off = { log: log.join('|'), on: b.shieldOn('ally'), shield: b.sides.ally.shield };
    b.ally.hp = maxOf(b.ally);
    const after = await dropOf('foe', 'tackle', [0.1, 0.5, 0.5]);
    make([F('woolumph', 30, ['tackle'])], [F('woolumph', 40, ['tackle'])]);
    const benchPlain = await dropOf('foe', 'tackle', [0.1, 0.5, 0.5]);
    R.shield = { plain: plain.drop, shielded: shielded.drop, shieldDraws, restSet, rested, stillOn, off, after: after.drop, benchShield: benchShield.drop, benchPlain: benchPlain.drop, benchPlainRef };

    // 4. risky
    make([F('emberpup', 30, ['wildblaze', 'tackle'])], [F('woolumph', 40, ['tackle'])]);
    S.MOVES.tmp60 = { name: 'Tmp', type: 'fire', power: 60, acc: 1, sure: true };
    const one = await dropOf('ally', 'tmp60', [0.1, 0.5, 0.5]);
    make([F('emberpup', 30, ['wildblaze', 'tackle'])], [F('woolumph', 40, ['tackle'])]);
    const win = await dropOf('ally', 'wildblaze', [0.1, 0.5, 0.5, 0.2]);
    log = make([F('emberpup', 30, ['wildblaze', 'tackle'])], [F('woolumph', 40, ['tackle'])]);
    const hpU = b.ally.hp;
    const lose = await dropOf('ally', 'wildblaze', [0.1, 0.5, 0.5, 0.7]);
    const loseState = { foeHp: b.foe.hp === maxOf(b.foe), hurt: hpU - b.ally.hp, log: log.join('|') };
    log = make([F('emberpup', 30, ['wildblaze', 'tackle'])], [F('woolumph', 40, ['tackle'])]);
    b.ally.hp = 1;
    await dropOf('ally', 'wildblaze', [0.1, 0.5, 0.5, 0.7]);
    delete S.MOVES.tmp60;
    R.risky = { one: one.drop, win: win.drop, winDraws: win.draws, lose: lose.draws, loseState, faint: b.ally.hp };

    // 5. sacrifice
    log = make([F('bubbuck', 30, ['wavegoodbye', 'bubble']), F('fluffin', 30, ['tackle'])], [F('woolumph', 40, ['tackle'])]);
    s = seq([0.1]); await b.useMove('ally', 'wavegoodbye');
    const sac = { hp: b.allies[0].hp, gift: b.sides.ally.gift, draws: s.n, log: log.join('|') };
    b.allies[1].hp = 3;
    b.allyIdx = 1; log.length = 0;
    b.modMap.delete(b.ally);
    await b.giftArrives('ally');
    sac.arrive = { hp: b.ally.hp === maxOf(b.ally), atk: b.mods(b.ally).atk, gift: b.sides.ally.gift, log: log.join('|') };
    log = make([F('bubbuck', 30, ['wavegoodbye', 'bubble'])], [F('woolumph', 40, ['tackle'])]);
    s = seq([0.1]); await b.useMove('ally', 'wavegoodbye');
    sac.blocked = { hp: b.ally.hp === maxOf(b.ally), draws: s.n, gift: b.sides.ally.gift, log: log.join('|') };
    R.sacrifice = sac;

    // 6. curse
    make([F('zapple', 30, ['staticfuzz', 'tackle'])], [F('woolumph', 40, ['tackle']), F('fluffin', 30, ['tackle'])]);
    s = seq([0.1, 0.3]); await b.useMove('ally', 'staticfuzz');
    const cu = { spd: b.mods(b.foe).spd, team: b.sides.foe.spd, draws: s.n };
    await arrive('foe', 1);
    cu.bench = b.mods(b.foe).spd;
    log = make([F('zapple', 30, ['staticfuzz', 'tackle'])], [F('woolumph', 40, ['tackle'])]);
    s = seq([0.1, 0.5]); await b.useMove('ally', 'staticfuzz');
    R.curse = { hit: cu, miss: { spd: b.mods(b.foe).spd, draws: s.n, log: log.join('|') } };

    // 7. field
    make([F('bubbuck', 30, ['hightide', 'bubble', 'ember'])], [F('woolumph', 40, ['bubble', 'ember', 'tackle'])]);
    b.round = 1;
    const w0 = await dropOf('ally', 'bubble', [0.1, 0.5, 0.5]);
    const wf0 = await dropOf('foe', 'bubble', [0.1, 0.5, 0.5]);
    const f0 = await dropOf('foe', 'ember', [0.1, 0.5, 0.5]);
    b.foe.hp = maxOf(b.foe); b.ally.hp = maxOf(b.ally);
    log = []; b.say = async x => { log.push(x); };
    s = seq([0.1]); await b.useMove('ally', 'hightide');
    const fieldDraws = s.n, fieldSet = b.field && { type: b.field.type, until: b.field.until };
    const w1 = await dropOf('ally', 'bubble', [0.1, 0.5, 0.5]);
    const wf1 = await dropOf('foe', 'bubble', [0.1, 0.5, 0.5]);
    const f1 = await dropOf('foe', 'ember', [0.1, 0.5, 0.5]);
    b.round = 6; const still = !!b.field; await b.tickEffects(); const stillAt6 = !!b.field;
    b.round = 7; log.length = 0; await b.tickEffects();
    R.field = { w0: w0.drop, w1: w1.drop, wf0: wf0.drop, wf1: wf1.drop, f0: f0.drop, f1: f1.drop, fieldDraws, fieldSet, still: stillAt6 && still, over: log.join('|'), gone: !b.field };

    // 8. lastword
    log = make([F('fluffin', 30, ['nevergiveup', 'tackle'])], [F('woolumph', 40, ['tackle'])]);
    const full = await dropOf('ally', 'nevergiveup', [0.1, 0.5, 0.5]);
    const fullLog = log.join('|');
    b.ally.hp = Math.floor(maxOf(b.ally) * 0.2);
    const low = await dropOf('ally', 'nevergiveup', [0.1, 0.5, 0.5]);
    R.lastword = { full: full.drop, fullDraws: full.draws, fullLog, low: low.drop, lowDraws: low.draws };

    // 9. AI
    const picks = (allyList, foeList, setup, n = 200) => {
      make(allyList, foeList); setup?.();
      const out = {};
      for (let i = 0; i < n; i++) { const id = b.pickFoeMove(); out[id] = (out[id] || 0) + 1; }
      return out;
    };
    const ai = {};
    ai.lastFull = picks([F('fluffin', 30, ['tackle'])], [F('woolumph', 40, ['nevergiveup', 'tackle'])]).nevergiveup || 0;
    ai.lastLow = picks([F('fluffin', 30, ['tackle'])], [F('woolumph', 40, ['nevergiveup', 'tackle'])], () => { b.foe.hp = 2; }).nevergiveup || 0;
    ai.sacNoBench = picks([F('fluffin', 30, ['tackle'])], [F('bubbuck', 40, ['wavegoodbye', 'bubble'])], () => { b.foe.hp = 2; }).wavegoodbye || 0;
    ai.sacBenchLow = picks([F('fluffin', 30, ['tackle'])], [F('bubbuck', 40, ['wavegoodbye', 'bubble']), F('fluffin', 30, ['tackle'])], () => { b.foe.hp = 2; }).wavegoodbye || 0;
    ai.rallyCap = picks([F('fluffin', 30, ['tackle'])], [F('woolumph', 40, ['goteamgo', 'tackle']), F('fluffin', 30, ['tackle'])], () => { b.sides.foe.atk = 3; }).goteamgo || 0;
    ai.fieldMatch = picks([F('fluffin', 30, ['tackle'])], [F('bubbuck', 40, ['hightide', 'bubble'])]).hightide || 0;
    ai.fieldNoMatch = picks([F('fluffin', 30, ['tackle'])], [F('bubbuck', 40, ['hightide', 'ember'])]).hightide || 0;
    ai.fieldAlready = picks([F('fluffin', 30, ['tackle'])], [F('bubbuck', 40, ['hightide', 'bubble'])], () => { b.field = { type: 'water', name: 'High Tide', boost: 1.5, until: 9 }; b.round = 1; }).hightide || 0;
    const rk = picks([F('fluffin', 30, ['tackle'])], [F('emberpup', 40, ['wildblaze', 'tackle'])], () => { b.foe.hp = 5; });
    ai.riskyLow = rk.wildblaze || 0;
    // a blocked move is never picked while another works (lastword at full HP)
    ai.onlyBlockedOthers = picks([F('fluffin', 30, ['tackle'])], [F('woolumph', 40, ['nevergiveup', 'tackle'])]).tackle || 0;
    R.ai = ai;

    // 10. mirror: same seed, sides swapped, a long script
    const mirror = async swap => {
      const A = [F('bubbuck', 30, ['wavegoodbye', 'hightide', 'bubble', 'tackle']), F('fluffin', 30, ['goteamgo', 'standtogether', 'nevergiveup', 'wildblaze'])];
      const Fz = [F('zapple', 30, ['staticfuzz', 'livewire', 'spark', 'tackle']), F('frostling', 30, ['bigfreeze', 'snowday', 'icebreath', 'goteamgo'])];
      const log = swap ? make(Fz, A) : make(A, Fz);
      const rng = mulberry32(77); let calls = 0; b.rng = () => { calls++; return rng(); };
      const SA = swap ? 'foe' : 'ally', SF = swap ? 'ally' : 'foe';
      const idx = (side, i) => { if (side === 'ally') b.allyIdx = i; else b.foeIdx = i; b.modMap.delete(side === 'ally' ? b.ally : b.foe); };
      const mv = async (side, id, first = false) => { await b.useMove(side, id, { first }); };
      const tick = async () => { b.round++; await b.tickEffects(); };
      await tick();
      await mv(SA, 'hightide', true); await mv(SF, 'staticfuzz');
      await tick();
      await mv(SF, 'livewire', true); await mv(SA, 'bubble');
      await tick();
      await mv(SA, 'wavegoodbye', true);
      idx(SA, 1); await b.giftArrives(SA);
      await mv(SF, 'spark');
      await tick();
      await mv(SA, 'standtogether', true); await mv(SF, 'tackle');
      await tick();
      await mv(SA, 'tackle', true); await mv(SF, 'livewire'); // rest, then risky
      await tick();
      await mv(SA, 'goteamgo', true); await mv(SF, 'staticfuzz');
      idx(SF, 1);
      await tick();
      await mv(SF, 'bigfreeze', true); await mv(SA, 'wildblaze');
      await tick();
      await mv(SF, 'snowday', true); await mv(SA, 'nevergiveup'); // blocked or not
      await tick(); await tick(); await tick();
      await mv(SA, 'tackle', true); await mv(SF, 'icebreath');
      const sA = swap ? b.foes : b.allies, sF = swap ? b.allies : b.foes;
      const act = side => (side === 'ally' ? b.ally : b.foe);
      return JSON.stringify({
        hpA: sA.map(c => c.hp), hpF: sF.map(c => c.hp), mA: b.mods(act(SA)), mF: b.mods(act(SF)), sidesA: b.sides[SA], sidesF: b.sides[SF],
        field: b.field, round: b.round, n: log.length, calls,
      });
    };
    const m1 = await mirror(false), m2 = await mirror(true);
    R.mirror = { same: m1 === m2, long: JSON.parse(m1).calls > 20, m1, m2 };

    // 11. draw table
    make([F('fluffin', 30, ['goteamgo', 'standtogether', 'wavegoodbye', 'staticfuzz', 'tackle', 'hightide', 'wildblaze', 'nevergiveup']), F('woolumph', 30, ['tackle'])], [F('woolumph', 40, ['tackle'])]);
    b.round = 1;
    const count = async (id, rolls, prep) => { prep?.(); const s = seq(rolls); await b.useMove('ally', id); return s.n; };
    const dr = {};
    dr.rally = await count('goteamgo', [0.1]);
    dr.shield = await count('standtogether', [0.1]);
    dr.rest = await count('tackle', [0.1, 0.5, 0.5]); // the rest turn after the shield
    dr.field = await count('hightide', [0.1]);
    dr.sacrifice = await count('wavegoodbye', [0.1]);
    b.allyIdx = 0; b.ally.hp = maxOf(b.ally); b.sides.ally.gift = false;
    dr.curse = await count('staticfuzz', [0.1, 0.3]);
    dr.risky = await count('wildblaze', [0.1, 0.5, 0.5, 0.2]);
    dr.lastwordBlocked = await count('nevergiveup', [0.1, 0.5, 0.5]);
    dr.lastword = await count('nevergiveup', [0.1, 0.5, 0.5], () => { b.ally.hp = 3; });
    R.draws = dr;

    // 12. gyms and rematches
    const G = await import('/src/gyms.js');
    const RM = await import('/src/rematch.js');
    const want = { kitegale: 'windyday', clangalarm: 'lastsecond', statuo: 'decoyswap', error404: 'lagspike', clickit2: 'levelboost', snoozebear: 'grouphug', dozeram: 'tuckin', kingcoin: 'jackpot', crownguard: 'treasurehunt' };
    const found = {};
    for (const gym of G.GYMS) for (const [sp, lv, mv] of gym.leaderTeam) if (want[sp]) found[sp] = { has: mv?.includes(want[sp]), n: mv?.length, dmg: S.MOVES[mv?.[0]]?.power > 0, lv, same: JSON.stringify(mv) === JSON.stringify(S.movesWith(sp, lv, want[sp])) };
    const treasure = G.GYMS.find(x => x.id === 'treasure' || x.leaderTeam.some(([sp]) => sp === 'kingcoin'));
    const rock = G.GYMS[0];
    const bigOf = tm => tm.map(([sp, lv, mv]) => ({ sp, lv, big: (mv || []).filter(S.isBig) }));
    const t3 = RM.rematchTeam(treasure, 2);
    const t1 = RM.rematchTeam(treasure, 0), t2 = RM.rematchTeam(treasure, 1);
    const hasBigByLevel = (sp, lv) => S.SPECIES[sp].learn.some(([l, m]) => S.isBig(m) && l <= lv && S.MOVES[m].fx.kind !== 'sacrifice');
    R.gyms = {
      found, treasure: treasure.id,
      t3: bigOf(t3).map(x => ({ ...x, should: hasBigByLevel(x.sp, x.lv), noSac: x.big.every(id => S.MOVES[id].fx.kind !== 'sacrifice' || ['tuckin', 'decoyswap'].includes(id)) })),
      tier12: [t1, t2].map(tm => bigOf(tm).filter(x => x.big.length).map(x => x.sp)),
      rock: [0, 1, 2].map(w => bigOf(RM.rematchTeam(rock, w)).reduce((n, x) => n + x.big.length, 0)),
    };
    return R;
  });

  // ---- checks ----
  const d = R.data;
  const oldCounts = { rally: 10, shield: 12, risky: 10, sacrifice: 11, curse: 10, field: 14, lastword: 8 }; // wave 14's four types add 2-3 each (Ball: rally, risky, field)
  t.ok(d.total >= 75 && d.total <= 75 + 12 && Object.entries(oldCounts).every(([k, n]) => d.counts[k] >= n),
    `at least 75 big moves (61 + wave 11's 11 + Ninja's 3, plus up to 12 of wave 14), kinds at least rally 10 shield 12 risky 10 sacrifice 11 curse 10 field 14 lastword 8 (${d.total}: ${JSON.stringify(d.counts)})`);
  t.ok(d.types >= 33 + (4 - PENDING.length) && d.minPer >= 2 && d.maxPer <= 3, `every type has 2 or 3 big moves (${d.types} types, ${d.minPer}-${d.maxPer})`);
  t.ok(d.flags && d.uniqueNames && !d.soundClash.length, `big moves have no signature or chance flag, unique names, no sound clash (${d.soundClash})`);
  t.ok(!d.learnBad.length, `every creature learns its type's big moves at BIG_LEVEL, none of another type ${d.learnBad.slice(0, 5)}`);
  t.ok(!d.autoBad.length && !d.swBig, `makeCreature and autoMoves never give a big move ${d.autoBad.slice(0, 5)}`);
  t.ok(d.mwOk && d.kinds === 'shield,rally,curse,field,risky,sacrifice,lastword', `movesWith puts named moves in, 4 moves, damage first (${d.mw})`);
  t.ok(d.offered.includes('standtogether') && d.offered.includes('goteamgo') && d.offered.includes('nevergiveup'), `level-ups offer the big moves, also caught-up ones (${d.offered})`);
  t.ok(d.lastwordPower === 140 && d.riskyPower === 60 && d.info.goteamgo.tags.includes('team attack up') && d.info.goteamgo.note.includes('Your defence goes down 2.')
    && d.info.standtogether.text.includes('you rest next turn') && d.info.wildblaze.text.includes('half the time x3, or it hits you')
    && d.info.wavegoodbye.text.includes('you faint') && d.info.staticfuzz.text.includes('may slow the whole foe team')
    && d.info.hightide.text.includes('Water moves stronger for 5 turns') && d.info.hightide.note.includes('For 5 turns Water moves are 50% stronger')
    && d.info.nevergiveup.text.includes('only below 1/4 HP') && d.info.nevergiveup.text.includes('never misses'),
    `moveInfo words per kind (${JSON.stringify(d.info.hightide)})`);

  const r = R.rally;
  t.ok(r.a0.atk === 1 && r.a0.team === 1 && r.a0.def === -2 && r.a0.draws === 1 && r.a0.log.includes('feels stronger') && r.benchAtk === 1 && r.second.atk === 2 && r.second.team === 2
    && r.cap.def && r.cap.log.includes("can't go any higher"), `rally: team +1 (bench too), defence -2, 1 draw, cap without price (${JSON.stringify(r)})`);
  const sh = R.shield;
  t.ok(Math.abs(sh.shielded - sh.plain * 0.7) <= 1 && sh.shieldDraws === 1 && sh.restSet && sh.stillOn, `shield: damage x0.7 (${sh.plain} -> ${sh.shielded}), 1 draw`);
  t.ok(sh.rested.draws === 0 && sh.rested.hurt === 0 && sh.rested.log.includes('resting') && !sh.rested.flag, `shield: the next move is a rest turn with no draws (${sh.rested.log})`);
  t.ok(sh.benchShield < sh.benchPlain && sh.off.log.includes('wore off') && !sh.off.on && Math.abs(sh.after - sh.benchPlain) <= 1, `shield: the bench is covered too, then it wears off (${sh.benchShield} < ${sh.benchPlain}; ${sh.off.log})`);
  const rk = R.risky;
  t.ok(Math.abs(rk.win - rk.one * 3) <= 3 && rk.winDraws === 4, `risky: a good coin is x3 (${rk.one} -> ${rk.win}), 4 draws`);
  t.ok(rk.lose === 4 && rk.loseState.foeHp && rk.loseState.hurt > 0 && rk.loseState.log.includes('hit itself') && rk.faint === 0, `risky: a bad coin hurts the user only, can knock it out (${JSON.stringify(rk.loseState)})`);
  const sc = R.sacrifice;
  t.ok(sc.hp === 0 && sc.gift && sc.draws === 1 && sc.arrive.hp && sc.arrive.atk === 1 && !sc.arrive.gift && sc.arrive.log.includes('fresh and strong'), `sacrifice: faints, next one arrives full HP + attack (${JSON.stringify(sc)})`);
  t.ok(sc.blocked.hp && sc.blocked.draws === 0 && !sc.blocked.gift && sc.blocked.log.includes("can't use"), `sacrifice: blocked with no friend, no draws (${sc.blocked.log})`);
  const cu = R.curse;
  t.ok(cu.hit.spd === -1 && cu.hit.team === -1 && cu.hit.bench === -1 && cu.hit.draws === 2, `curse: slows active, team and the bench arrival, 2 draws (${JSON.stringify(cu.hit)})`);
  t.ok(cu.miss.spd === 0 && cu.miss.draws === 2 && cu.miss.log.includes("didn't work"), 'curse: a bad roll does nothing, still 2 draws');
  const fd = R.field;
  t.ok(Math.abs(fd.w1 - fd.w0 * 1.5) <= 1 && Math.abs(fd.wf1 - fd.wf0 * 1.5) <= 1 && fd.f1 === fd.f0 && fd.fieldDraws === 1 && fd.fieldSet.type === 'water',
    `field: water x1.5 for both sides, fire unchanged (${fd.w0}->${fd.w1}, ${fd.wf0}->${fd.wf1}, ${fd.f0}/${fd.f1})`);
  t.ok(fd.still && fd.over.includes('is over') && fd.gone, `field: lasts 5 more rounds, then "is over" (${fd.over})`);
  const lw = R.lastword;
  t.ok(lw.full === 0 && lw.fullDraws === 0 && lw.fullLog.includes("can't use") && lw.low > 0 && lw.lowDraws === 3, `lastword: blocked at full HP (0 draws), hits when low (3 draws) (${JSON.stringify(lw)})`);
  const ai = R.ai;
  t.ok(ai.lastFull === 0 && ai.lastLow > 0 && ai.sacNoBench === 0 && ai.sacBenchLow > 0 && ai.rallyCap === 0 && ai.fieldMatch > 0 && ai.fieldNoMatch === 0 && ai.fieldAlready === 0 && ai.onlyBlockedOthers === 200,
    `foe AI: lastword only when low, sacrifice only with a bench, no capped rally, field only with a matching attack (${JSON.stringify(ai)})`);
  t.ok(ai.riskyLow === 0, `foe AI: no risky move when low (${ai.riskyLow})`);
  t.ok(R.mirror.same && R.mirror.long, `mirror run: sides swapped give the same battle (${R.mirror.m1.slice(0, 200)})`);
  t.ok(JSON.stringify(R.draws) === JSON.stringify({ rally: 1, shield: 1, rest: 0, field: 1, sacrifice: 1, curse: 2, risky: 4, lastwordBlocked: 0, lastword: 3 }), `draws per kind (${JSON.stringify(R.draws)})`);
  const gy = R.gyms;
  t.ok(Object.keys(gy.found).length === 9 && Object.values(gy.found).every(f => f.has && f.n === 4 && f.dmg && f.same), `the 9 leader creatures know their big move, 4 moves, damage first, written out exactly as movesWith gives them (${JSON.stringify(gy.found)})`);
  t.ok(gy.t3.every(x => x.should ? x.big.length > 0 : true) && gy.t3.every(x => x.noSac) && gy.tier12.every(l => l.length === 0 || l.every(sp => ['kingcoin', 'crownguard'].includes(sp))) && gy.rock.every(n => n === 0),
    `rematch: tier 3 gives a big move where one exists, tiers 1-2 and Boulder add none (${JSON.stringify(gy.t3)} / ${JSON.stringify(gy.tier12)} / ${gy.rock})`);

  // ---- 13. the real buttons ----
  await platform(page);
  await pause(page);
  await page.evaluate(() => { const b = window.pokecraft.battle; for (const k of ['say', 'lunge', 'flash', 'refresh']) delete b[k]; delete b.rng; b.rng = Math.random; });
  await startUi(page, { species: 'fluffin', level: 40, moves: ['nevergiveup', 'goteamgo', 'standtogether', 'tackle'] });
  await ready(page);
  await page.waitForTimeout(400);
  let bs = await buttons(page);
  const ng = bs.find(x => x.label === 'Never Give Up');
  t.ok(ng && ng.disabled && ng.sub.includes('only below 1/4 HP'), `Never Give Up is greyed with the reason at full HP (${JSON.stringify(ng)})`);
  await page.screenshot({ path: path.join(SHOTS, 't25-buttons.png') });
  await page.evaluate(() => { const g = window.pokecraft; g.battle.ally.hp = Math.floor(g.battle.ally.hp * 0.2); g.battle.refresh(); });
  await press(page, 'Go Team Go!');
  await page.waitForSelector('#b-ally .b-tags', { timeout: 90000 });
  const tag = await page.evaluate(() => document.querySelector('#b-ally .b-tags').textContent);
  t.ok(tag.includes('ATK'), `Go Team Go! shows the ATK tag (${tag})`);
  await ready(page);
  bs = await buttons(page);
  t.ok(bs.find(x => x.label === 'Never Give Up')?.disabled === false, 'Never Give Up works below 1/4 HP');
  await press(page, 'Stand Together');
  await page.waitForFunction(() => [...document.querySelectorAll('#b-actions button')].some(b => b.firstChild.textContent === 'Rest'), null, { timeout: 90000, polling: 100 });
  bs = await buttons(page);
  const shieldTag = await page.evaluate(() => document.querySelector('#b-ally .b-tags')?.textContent || '');
  t.ok(bs[0].label === 'Rest' && bs.slice(1, 5).every(x => x.disabled) && shieldTag.includes('Stand Together'), `after a shield there is a Rest button and a shield tag (${bs[0].label}; ${shieldTag})`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 't25-rest.png') });
  await press(page, 'Rest');
  await page.waitForFunction(() => ![...document.querySelectorAll('#b-actions button')].some(b => b.firstChild.textContent === 'Rest') && document.querySelector('#b-actions button:not([disabled])'), null, { timeout: 90000, polling: 100 });
  bs = await buttons(page);
  t.ok(bs.find(x => x.label === 'Never Give Up')?.disabled === false, 'after resting, Never Give Up is ready again');
  await playBattle(page);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), 'the battle finishes');

  // ---- 14. the Book ----
  const note = await page.evaluate(async () => {
    const bk = window.pokecraft.book;
    bk.open({ move: 'hightide' });
    await new Promise(r => setTimeout(r, 600));
    return document.getElementById('book')?.textContent || document.body.textContent;
  });
  t.ok(note.includes('5 turns') && note.includes('Foes too'), 'the Book move page for High Tide says 5 turns and Foes too');
  await page.keyboard.press('Escape');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // ---- 15. a real duel ----
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await B.waitForTimeout(4000);
  const setTeam = (p, list) => p.evaluate(async list => {
    const S = await import('/src/species.js');
    window.pokecraft.party = list.map(([sp, lv, mv]) => S.makeCreature(sp, lv, mv));
  }, list);
  await setTeam(A, [['bubbuck', 28, ['hightide', 'wavegoodbye', 'bubble', 'tidecrash']], ['fluffin', 28, ['goteamgo', 'standtogether', 'nevergiveup', 'tackle']]]);
  await setTeam(B, [['zapple', 28, ['staticfuzz', 'livewire', 'spark', 'thunderjolt']], ['frostling', 28, ['bigfreeze', 'snowday', 'icebreath', 'blizzard']]]);
  const stand = (p, dx) => p.evaluate(dx => {
    const g = window.pokecraft, s = g.spawnPoint, y = 42;
    for (let x = -2; x <= 5; x++) for (let z = -2; z <= 2; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
    g.player.pos.set(Math.floor(s.x) + 0.5 + dx, y + 1, Math.floor(s.z) + 0.5);
    g.player.vel.set(0, 0, 0);
  }, dx);
  await stand(A, 0); await stand(B, 3);
  await A.waitForTimeout(1500);
  await A.evaluate(() => { const g = window.pokecraft; g.duels.challenge([...g.mp.others.values()][0]); });
  await B.waitForFunction(() => !document.getElementById('ask').classList.contains('hidden'), null, { timeout: 30000 });
  await click(B, '#ask-yes');
  await A.waitForFunction(() => window.pokecraft.inBattle, null, { timeout: 30000 });
  const scripts = new Map([[A, ['hightide', 'wavegoodbye', 'goteamgo', 'standtogether', 'nevergiveup']], [B, ['staticfuzz', 'livewire', 'bigfreeze', 'snowday']]]);
  let shotDone = false;
  for (let i = 0; i < 300; i++) {
    let busy = false;
    for (const p of [A, B]) {
      if (!(await p.evaluate(() => window.pokecraft.inBattle))) continue;
      busy = true;
      const queue = scripts.get(p);
      const bs2 = await buttons(p);
      const next = queue.find(l => bs2.some(x => x.label.replace(/'/g, '') && x.disabled === false && x.label === ({ hightide: 'High Tide', wavegoodbye: 'Wave Goodbye', goteamgo: 'Go Team Go!', standtogether: 'Stand Together', nevergiveup: 'Never Give Up', staticfuzz: 'Static Fuzz', livewire: 'Live Wire', bigfreeze: 'Big Freeze', snowday: 'Snow Day' })[l]));
      if (next) {
        queue.splice(queue.indexOf(next), 1);
        const name = { hightide: 'High Tide', wavegoodbye: 'Wave Goodbye', goteamgo: 'Go Team Go!', standtogether: 'Stand Together', nevergiveup: 'Never Give Up', staticfuzz: 'Static Fuzz', livewire: 'Live Wire', bigfreeze: 'Big Freeze', snowday: 'Snow Day' }[next];
        await press(p, name);
      } else {
        await p.evaluate(() => {
          const e = [...document.querySelectorAll('#b-actions button:not([disabled])')].filter(b => b.firstChild.textContent !== 'Give up');
          (e.find(b => { const s = b.querySelector('small')?.textContent || ''; return s.includes('power ') && !s.includes('half the time'); }) || e[0])?.click();
        });
      }
    }
    if (!busy) break;
    await A.waitForTimeout(600);
  }
  const state = p => p.evaluate(() => {
    const b = window.pokecraft.battle;
    return { mine: b.allies.map(c => c.hp), theirs: b.foes.map(c => c.hp), sides: b.sides, field: b.field, round: b.round, n: b.history.length, log: b.history.join('|') };
  });
  const sA = await state(A), sB = await state(B);
  t.ok(!(await A.evaluate(() => window.pokecraft.inBattle)) && !(await B.evaluate(() => window.pokecraft.inBattle)), 'the duel with big moves finishes');
  t.ok(sA.n > 5 && sA.n === sB.n && sA.round === sB.round && sA.round > 3, `both browsers logged the same lines and rounds (${sA.n} / ${sB.n}, round ${sA.round})`);
  t.ok(JSON.stringify(sA.mine) === JSON.stringify(sB.theirs) && JSON.stringify(sA.theirs) === JSON.stringify(sB.mine), `both browsers agree on every HP (${JSON.stringify([sA.mine, sA.theirs])} / ${JSON.stringify([sB.mine, sB.theirs])})`);
  t.ok(JSON.stringify(sA.sides.ally) === JSON.stringify(sB.sides.foe) || sA.sides.ally.shield?.name === sB.sides.foe.shield?.name, 'team states mirror each other');
  t.ok(JSON.stringify(sA.field) === JSON.stringify(sB.field), 'the field is the same in both browsers');
  const all = sA.log + '|' + sB.log;
  const seen = ['feels stronger', 'covers', 'fresh and strong', 'slower', "didn't work"].filter(w => all.includes(w));
  t.ok(seen.length >= 3, `the duel log shows big move effects (${seen.join(', ')})`);
  t.ok(!A.errors.length && !B.errors.length, `no page errors in the duel ${[...A.errors, ...B.errors].join('; ')}`);
  await A.context().close(); await B.context().close();
}
