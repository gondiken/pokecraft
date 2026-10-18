// T29 co-op boss: two players, one giant. Data, the ask and its checks, a full battle on two browsers that
// must agree on every turn (equal traces), one player's team running out, giving up, and the old-version ask.
import { openPair, newGame, click, pause } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const inBattle = page => page.evaluate(() => window.pokecraft.inBattle);
const askShown = page => page.evaluate(() => !document.getElementById('duel-ask').classList.contains('hidden'));
const teamKey = page => page.evaluate(() => JSON.stringify(window.pokecraft.party.map(c => [c.uid, c.species, c.level, c.xp, c.moves])));

async function waitFor(page, fn, ms = 60000) {
  for (let t = 0; t < ms; t += 300) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

// Each player keeps pressing the first power move (or the first button), and we remember if the giant ever warned.
async function playCoop(pages, avoid = 'Give up') {
  for (let i = 0; i < 300; i++) {
    let busy = false;
    for (const page of pages) {
      if (!(await inBattle(page))) continue;
      busy = true;
      await page.evaluate(avoid => {
        const g = window.pokecraft;
        if (g.battle.history.some(h => h.includes('getting ready for something big'))) window.__sawBig = true;
        const bs = [...document.querySelectorAll('#b-actions button:not([disabled])')].filter(b => !b.textContent.startsWith(avoid));
        (bs.find(b => b.querySelector('small')?.textContent.includes('power ')) || bs[0])?.click();
      }, avoid);
    }
    if (!busy) return true;
    await pages[0].waitForTimeout(500);
  }
  return false;
}

export default async function ({ browser, base, t }) {
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);

  // 1. Data
  const data = await A.evaluate(async () => {
    const C = await import('/src/coopboss.js');
    const S = await import('/src/species.js');
    const out = { bosses: [], bigs: [] };
    for (const [id, b] of Object.entries(C.BOSSES)) {
      out.bosses.push([id, !!S.SPECIES[b.species], !S.SPECIES[b.species]?.legendary, C.bossName(id)]);
      for (const m of b.big) out.bigs.push([m, !!S.MOVES[m]?.big, S.MOVES[m]?.fx?.kind]);
    }
    const lv = (s, l) => S.makeCreature(s, l);
    const boss = C.makeBoss('giant1', [lv('zapple', 30)], [lv('zapple', 40)]);
    const swapped = C.makeBoss('giant1', [lv('zapple', 40)], [lv('zapple', 30)]);
    const plain = S.statsFor({ species: boss.species, level: 42 }).maxHp;
    const normal = S.statsFor({ species: boss.species, level: 42, giant: undefined }).maxHp;
    let same = true;
    for (const id of Object.keys(S.SPECIES).slice(0, 20)) {
      const c = S.makeCreature(id, 20);
      const base = Math.floor((S.SPECIES[id].base.hp * 2 * 20) / 100) + 20 + 10;
      if (S.statsFor(c).maxHp !== base) same = false;
    }
    return {
      out, level: boss.level, hp: boss.hp, plain, normal, giant: boss.giant, same,
      moves: boss.moves, swappedOk: JSON.stringify([boss.level, boss.moves, boss.hp]) === JSON.stringify([swapped.level, swapped.moves, swapped.hp]),
    };
  });
  t.ok(data.out.bosses.length === 3 && data.out.bosses.every(b => b[1] && b[2]), 'the three giants are real, normal species');
  t.ok(data.out.bosses[0][3] === 'Giant Cragtusk', 'bossName says "Giant Cragtusk"');
  t.ok(data.out.bigs.length === 6 && data.out.bigs.every(b => b[1] && b[2]), 'every planned big move is a T25 big move');
  t.ok(data.level === 42 && data.hp === Math.floor(data.plain * 3) && data.giant === 3, `the giant is Lv 42 with 3x HP (${data.hp} vs ${data.plain})`);
  t.ok(data.moves.includes('stonefort') && data.moves.includes('cliffcrash'), `the giant knows both big moves (${data.moves})`);
  t.ok(data.swappedOk, 'makeBoss gives the same giant with the teams swapped');
  t.ok(data.same && data.normal === data.plain, 'statsFor is unchanged without `giant`');

  // 3a. coopFor errors before playing together
  const e1 = await A.evaluate(() => window.pokecraft.coopFor(window.pokecraft, 'giant1', { id: 'x', name: 'Kid' }));
  t.ok(e1.error?.includes('Play together'), `alone: "${e1.error}"`);

  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await B.waitForTimeout(4000);

  const teams = async (a, b) => {
    await A.evaluate(async spec => {
      const g = window.pokecraft, S = await import('/src/species.js');
      g.party = spec.map(([sp, lv]) => S.makeCreature(sp, lv));
    }, a);
    await B.evaluate(async spec => {
      const g = window.pokecraft, S = await import('/src/species.js');
      g.party = spec.map(([sp, lv]) => S.makeCreature(sp, lv));
    }, b);
  };
  await teams([['blazehound', 34], ['ampup', 34]], [['zapple', 34], ['thornox', 34]]);
  // Both stand on a wide stone platform high in the air; the giant (6 blocks ahead) stands on it too.
  const stand = (page, dx) => page.evaluate(dx => {
    const g = window.pokecraft, s = g.spawnPoint, y = 42;
    for (let x = -6; x <= 16; x++) for (let z = -12; z <= 12; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
    g.player.pos.set(Math.floor(s.x) + 0.5 + dx, y + 1, Math.floor(s.z) + 0.5);
    g.player.vel.set(0, 0, 0);
  }, dx);
  await stand(A, 0);
  await stand(B, 3);
  await A.waitForTimeout(1500);
  const look = () => A.evaluate(() => {
    const g = window.pokecraft, kid = [...g.mp.others.values()][0];
    g.player.lookAt(kid.pos.clone().setY(kid.pos.y + 1));
  });
  await look();
  for (const page of [A, B]) {
    await page.evaluate(async () => {
      const { BOSSES } = await import('/src/coopboss.js');
      BOSSES.giant1.plan = ['a', 'stonefort', 'a', 'cliffcrash'];
      BOSSES.giant1.giant = 2.5;
      const g = window.pokecraft;
      if (g.missions) g.missionState.active = 'giant1';
    });
  }

  // 3. coopFor errors and success
  const errs = await A.evaluate(() => {
    const g = window.pokecraft, kid = [...g.mp.others.values()][0];
    const far = { id: kid.id, name: 'Kid', pos: kid.pos.clone().setX(kid.pos.x + 20) };
    return {
      far: g.coopFor(g, 'giant1', far).error, notBoss: g.coopFor(g, 'nope', kid).error,
      gone: g.coopFor(g, 'giant1', { id: 'zz', name: 'X', pos: kid.pos }).error, ok: g.coopFor(g, 'giant1', kid),
    };
  });
  t.ok(errs.far === 'Walk closer to Kid first.', `too far: "${errs.far}"`);
  t.ok(errs.notBoss === 'This mission is not a boss battle.', `not a boss mission: "${errs.notBoss}"`);
  t.ok(errs.gone === 'Your friend left the world.', `friend gone: "${errs.gone}"`);
  t.ok(errs.ok.boss === 'giant1' && errs.ok.at.length === 3 && errs.ok.at.every(Number.isFinite), `3 blocks apart is fine: ${JSON.stringify(errs.ok)}`);

  const teamA = await teamKey(A), teamB = await teamKey(B);
  const cubesA = await A.evaluate(() => window.pokecraft.cubes), cubesB = await B.evaluate(() => window.pokecraft.cubes);
  const ask = async () => {
    const r = await A.evaluate(() => { const g = window.pokecraft, kid = [...g.mp.others.values()][0]; const c = g.coopFor(g, 'giant1', kid); if (!c.error) g.duels.challenge(kid, c); return c; });
    if (r.error) console.log(`      (ask refused: ${r.error})`);
    else if (!(await waitFor(B, () => !document.getElementById('duel-ask').classList.contains('hidden')))) {
      console.log('      (no ask on B: ' + JSON.stringify(await A.evaluate(() => ({ a: !!window.pokecraft.duels.asking, c: !!window.pokecraft.duels.current, b: window.pokecraft.inBattle }))) + ' / ' + JSON.stringify(await B.evaluate(() => ({ i: !!window.pokecraft.duels.incoming, c: !!window.pokecraft.duels.current, b: window.pokecraft.inBattle }))) + ')');
    }
  };

  // 4. The ask, the question, the start
  await ask();
  t.ok(await waitFor(B, () => !document.getElementById('duel-ask').classList.contains('hidden')
    && document.getElementById('duel-text').textContent.includes('needs your help')
    && document.getElementById('duel-text').textContent.includes('Giant Cragtusk')), 'the friend is asked "Dad needs your help! A Giant Cragtusk ..."');
  await click(B, '#duel-yes');
  t.ok(await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B), 'saying yes starts the battle for both');
  t.ok(await waitFor(A, () => !!window.pokecraft.battle.friendModel && !!window.pokecraft.battle.foeModel && !document.getElementById('b-friend').classList.contains('hidden'), 30000)
    && await waitFor(B, () => !!window.pokecraft.battle.friendModel && !!window.pokecraft.battle.foeModel && !document.getElementById('b-friend').classList.contains('hidden'), 30000),
  'both see the giant, the friend\'s creature and the third card');
  const view = page => page.evaluate(() => {
    const b = window.pokecraft.battle;
    return { coop: !!b.coop, scale: b.foeModel.scale.x, friend: document.getElementById('b-friend').textContent, foe: b.foe.species, giant: b.foe.giant,
      friendSp: b.friend.species, ally: b.ally.species };
  });
  await A.waitForTimeout(1500);
  const vA = await view(A), vB = await view(B);
  t.ok(vA.coop && vB.coop && Math.abs(vA.scale - 1.8) < 0.05, `the giant is drawn at about 1.8x (${vA.scale.toFixed(2)})`);
  t.ok(vA.friend.includes("Kid's") && vB.friend.includes("Dad's"), `the third card names the friend ("${vA.friend.slice(0, 30)}")`);
  t.ok(vA.friendSp === vB.ally && vB.friendSp === vA.ally && vA.giant === 2.5 && vB.giant === 2.5, 'each sees the other\'s creature as the friend; the giant is the same');
  await waitFor(A, () => [...document.querySelectorAll('#b-actions button')].length > 0, 30000);
  await A.screenshot({ path: SHOTS + 't29-coop.png' });

  // 5/6. Play the whole battle
  t.ok(await playCoop([A, B]), 'the battle finishes');
  const res = async p => p.evaluate(() => window.pokecraft.duels.lastResult);
  const info = page => page.evaluate(() => ({ trace: window.pokecraft.battle.trace, big: !!window.__sawBig }));
  const iA = await info(A), iB = await info(B);
  t.ok(iA.trace.length > 3 && JSON.stringify(iA.trace) === JSON.stringify(iB.trace), `both browsers have the same trace (${iA.trace.length} steps)`);
  t.ok(iA.trace.some(e => e[1] === 2) && iA.trace.some(e => e[1] === 0) && iA.trace.some(e => e[1] === 1), 'the trace has the asker, the helper and the giant');
  t.ok(iA.trace.some(e => e[1] === 2 && (e[2] === 'stonefort' || e[2] === 'cliffcrash')), `the giant used a big move (${iA.trace.filter(e => e[1] === 2).map(e => e[2])})`);
  t.ok(iA.big || iB.big, 'the log said "getting ready for something big"');
  let hitsP1 = 0, hitsP2 = 0, prev = null;
  for (const e of iA.trace) {
    if (prev && e[1] === 2) { if (e[3] < prev[3]) hitsP1++; if (e[4] < prev[4]) hitsP2++; }
    prev = e;
  }
  console.log(`      (the giant hurt the asker ${hitsP1}x and the helper ${hitsP2}x)`);
  const rA = await res(A), rB = await res(B);
  t.ok(rA === 'won' && rB === 'won', `both won (${rA} / ${rB})`);
  t.ok(await teamKey(A) === teamA && await teamKey(B) === teamB, 'real teams are unchanged');
  if (await A.evaluate(() => !!window.pokecraft.missions?.coopEnded)) {
    t.ok(await A.evaluate(() => window.pokecraft.missionState.done.includes('giant1')) && await A.evaluate(() => window.pokecraft.blockCounts[77]) === 2
      && await A.evaluate(() => window.pokecraft.cubes) === cubesA + 10, 'rewards: the asker gets 2 trophies and 10 cubes');
    t.ok(await B.evaluate(() => window.pokecraft.blockCounts[77]) === 1 && await B.evaluate(() => window.pokecraft.cubes) === cubesB + 5, 'the helper gets 1 trophy and 5 cubes');
  } else console.log('      skipped: needs builder A (rewards)');

  // 7. One team out: the kid has one weak creature
  await teams([['blazehound', 40], ['ampup', 40]], [['zapple', 5]]);
  await look();
  await ask();
  await waitFor(B, () => !document.getElementById('duel-ask').classList.contains('hidden'));
  await B.keyboard.press('y');
  t.ok(await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B), 'a second giant battle starts');
  t.ok(await playCoop([A, B]), 'it finishes with one team tired out');
  const hist = await B.evaluate(() => window.pokecraft.battle.history.join('|'));
  const histA = await A.evaluate(() => window.pokecraft.battle.history.join('|'));
  t.ok(hist.includes('Cheer for Dad'), 'the tired player is told to cheer');
  t.ok(histA.includes("Kid's team is tired out"), 'the other player is told their friend is out');
  const i2A = await info(A), i2B = await info(B);
  t.ok(JSON.stringify(i2A.trace) === JSON.stringify(i2B.trace) && i2A.trace.length > 0, `the traces still agree (${i2A.trace.length} steps)`);
  const out = i2A.trace.findIndex(e => e[4] === 0);
  t.ok(out < 0 || i2A.trace.slice(out).filter(e => e[1] === 2).every(e => e[3] <= (i2A.trace[out][3])), 'after the helper is out the giant only hurts the asker');
  t.ok(await res(A) === await res(B), `both end the same way (${await res(A)})`);

  // 8. Give up
  await teams([['blazehound', 30]], [['zapple', 30]]);
  await look();
  await ask();
  await waitFor(B, () => !document.getElementById('duel-ask').classList.contains('hidden'));
  await B.keyboard.press('y');
  t.ok(await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B), 'a third giant battle starts');
  await waitFor(A, () => [...document.querySelectorAll('#b-actions button')].some(b => b.textContent === 'Give up'), 40000);
  await A.evaluate(() => [...document.querySelectorAll('#b-actions button')].find(b => b.textContent === 'Give up').click());
  t.ok(await playCoop([A, B]), 'giving up ends the battle');
  t.ok(await res(A) === 'gaveup' && await res(B) === 'ended', `the one who left: ${await res(A)}, the other: ${await res(B)}`);
  t.ok((await B.evaluate(() => window.pokecraft.battle.history.join('|'))).includes('left the giant battle'), 'the other player is told "left the giant battle"');
  t.ok(!(await inBattle(A)) && !(await inBattle(B)), 'both are out of the battle');

  // 9. An ask from an old game, and a broken ask
  const odd = await B.evaluate(() => {
    const g = window.pokecraft, d = g.duels, from = [...g.mp.others.keys()][0];
    const base = { type: 'ask', id: 'old1', from, name: 'Dad', seed: 1, team: [{ species: 'zapple', level: 5, moves: ['spark'] }] };
    d.onMessage({ ...base, v: 8, coop: { mission: 'giant1', boss: 'giant1', at: [1, 2, 3] } });
    const a = !!d.incoming;
    d.onMessage({ ...base, v: 9, id: 'bad1', coop: { mission: 'giant1', boss: 'nope', at: [1, 2, 3] } });
    const b = !!d.incoming;
    d.onMessage({ ...base, v: 9, id: 'bad2', coop: { mission: 'giant1', boss: 'giant1', at: [1, 2] } });
    return { a, b, c: !!d.incoming, shown: !document.getElementById('duel-ask').classList.contains('hidden') };
  });
  t.ok(!odd.a && !odd.b && !odd.c && !odd.shown, 'an ask from an older game or with a broken coop field is answered no');

  t.ok(A.errors?.length === 0 || !A.errors, 'no errors on Dad\'s page');
  t.ok(B.errors?.length === 0 || !B.errors, 'no errors on Kid\'s page');
}
