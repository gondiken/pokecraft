// Battles between two players in the same world: asking, saying no, a full battle (both
// browsers must agree on every turn), giving up, the 3-cube prize, and nobody's team getting hurt.
import { openPair, newGame, click, pause } from '../helpers.mjs';

const inBattle = page => page.evaluate(() => window.pokecraft.inBattle);
const askShown = page => page.evaluate(() => !document.getElementById('duel-ask').classList.contains('hidden'));
const teamKey = page => page.evaluate(() => JSON.stringify(window.pokecraft.party.map(c => [c.uid, c.species, c.level, c.xp, c.moves])));
const cubes = page => page.evaluate(() => window.pokecraft.cubes);

// Each player keeps pressing the first button (a move, a creature to send out, or "Continue").
async function playDuel(pages, avoid = 'Give up') {
  for (let i = 0; i < 200; i++) {
    let busy = false;
    for (const page of pages) {
      if (!(await inBattle(page))) continue;
      busy = true;
      await page.evaluate(avoid => {
        const bs = [...document.querySelectorAll('#b-actions button:not([disabled])')].filter(b => !b.textContent.startsWith(avoid));
        bs[0]?.click();
      }, avoid);
    }
    if (!busy) return true;
    await pages[0].waitForTimeout(600);
  }
  return false;
}

async function waitFor(page, fn, ms = 15000) {
  for (let t = 0; t < ms; t += 300) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

export default async function ({ browser, base, t }) {
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

  // Fairly even teams, so both sides take hits. One of the kid's creatures is tired (the copies
  // used in the battle are at full HP).
  await A.evaluate(async () => {
    const g = window.pokecraft;
    const { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('blazehound', 18), makeCreature('ampup', 16)];
  });
  await B.evaluate(async () => {
    const g = window.pokecraft;
    const { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('zapple', 18), makeCreature('grovebeast', 18)];
    g.party[1].hp = 1;
    // Stand right in front of Dad.
    const s = g.spawnPoint;
    g.player.pos.set(s.x + 2.5, s.y, s.z);
  });
  await A.evaluate(() => { const g = window.pokecraft; g.player.pos.copy(g.spawnPoint); });
  await A.waitForTimeout(1500);
  await A.evaluate(() => {
    const g = window.pokecraft;
    const kid = [...g.mp.others.values()][0];
    g.player.lookAt(kid.pos.clone().setY(kid.pos.y + 1));
  });
  t.ok(await waitFor(A, () => document.getElementById('prompt').textContent.includes('Kid · click or E to ask for a battle')),
    'looking at the other player shows "click or E to ask for a battle"');
  const teamA = await teamKey(A), teamB = await teamKey(B);
  const cubesA = await cubes(A), cubesB = await cubes(B);

  // Asking, and saying "Not now".
  await A.evaluate(() => window.pokecraft.interact());
  t.ok(await waitFor(B, () => !document.getElementById('duel-ask').classList.contains('hidden')
    && document.getElementById('duel-text').textContent.includes('Dad wants')), 'the other player is asked "Dad wants to have a creature battle"');
  await click(B, '#duel-no');
  t.ok(await waitFor(A, () => !window.pokecraft.duels.asking), 'saying "Not now" tells the asker');
  t.ok(!(await inBattle(A)) && !(await inBattle(B)) && !(await askShown(B)), 'nobody is in a battle after "Not now"');

  // Asking again and saying yes, then a full battle.
  await A.evaluate(() => window.pokecraft.interact());
  await waitFor(B, () => !document.getElementById('duel-ask').classList.contains('hidden'));
  await click(B, '#duel-yes');
  t.ok(await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B), 'saying "Battle!" starts the battle for both players');
  t.ok(await playDuel([A, B]), 'the battle finishes');
  const resA = await A.evaluate(() => window.pokecraft.duels.lastResult);
  const resB = await B.evaluate(() => window.pokecraft.duels.lastResult);
  t.ok([resA, resB].sort().join() === 'lost,won', `one player wins, the other loses (Dad: ${resA}, Kid: ${resB})`);
  const [W, L, cubesW, cubesL] = resA === 'won' ? [A, B, cubesA, cubesB] : [B, A, cubesB, cubesA];
  const hp = page => page.evaluate(() => ({ mine: window.pokecraft.battle.allies.map(c => c.hp), theirs: window.pokecraft.battle.foes.map(c => c.hp) }));
  const hA = await hp(A), hB = await hp(B);
  t.ok(JSON.stringify(hA.mine) === JSON.stringify(hB.theirs) && JSON.stringify(hA.theirs) === JSON.stringify(hB.mine),
    `both browsers agree on every creature's HP (${JSON.stringify(hA)} / ${JSON.stringify(hB)})`);
  t.ok(await cubes(W) === cubesW + 3 && await cubes(L) === cubesL, 'the winner gets 3 Capture Cubes, the other player loses none');
  t.ok(await teamKey(A) === teamA && await teamKey(B) === teamB, 'both teams are unchanged (no creatures lost, no XP)');
  t.ok(await B.evaluate(() => window.pokecraft.party[1].hp >= 1 && window.pokecraft.party[0].hp > 0), "the loser's real creatures were not hurt");

  // Accepting with the Y key, then giving up.
  const challenge = () => A.evaluate(() => { const g = window.pokecraft; g.duels.challenge([...g.mp.others.values()][0]); });
  await challenge();
  await waitFor(B, () => !document.getElementById('duel-ask').classList.contains('hidden'));
  await B.keyboard.press('y');
  t.ok(await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B), 'pressing Y accepts');
  await waitFor(B, () => [...document.querySelectorAll('#b-actions button')].some(b => b.textContent === 'Give up'), 30000);
  await B.evaluate(() => [...document.querySelectorAll('#b-actions button')].find(b => b.textContent === 'Give up').click());
  t.ok(await playDuel([A, B]), 'giving up ends the battle');
  const cubesNow = await cubes(A);
  t.ok(await A.evaluate(() => window.pokecraft.duels.lastResult) === 'won' && cubesNow === (resA === 'won' ? cubesA + 6 : cubesA + 3),
    'when the other player gives up you win 3 cubes');
  t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].join('; ')}`);
  await A.context().close(); await B.context().close();
}
