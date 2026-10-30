// Battles between two players in the same world: asking, saying no, a full battle (both
// browsers must agree on every turn), giving up, the 3-cube prize, and nobody's team getting hurt.
// T12: an open team screen or Book closes when the battle starts, "Give up" while waiting, a
// player who stops answering, an invite during another battle ("busy"), and duels.reset().
import { openPair, newGame, click, pause, playBattle } from '../helpers.mjs';

const inBattle = page => page.evaluate(() => window.pokecraft.inBattle);
const askShown = page => page.evaluate(() => !document.getElementById('ask').classList.contains('hidden'));
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
        (bs.find(b => b.querySelector('small')?.textContent.includes('power ')) || bs[0])?.click();
      }, avoid);
    }
    if (!busy) return true;
    await pages[0].waitForTimeout(600);
  }
  return false;
}

// Wave 17: E on a friend opens the friend menu; its Battle asks for the battle.
async function askBattle(page) {
  await waitFor(page, () => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.player.lookAt(k.pos.clone().setY(k.pos.y + 1)); return g.interact() && g.swapUi.isOpen; }, 60000);
  await page.evaluate(() => document.querySelector('#friend [data-friend="battle"]').click());
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
    g.party = [makeCreature('blazehound', 18, ['infernodash', 'flameburst']), makeCreature('ampup', 16, ['staticsnap', 'spark'])];
  });
  await B.evaluate(async () => {
    const g = window.pokecraft;
    const { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('zapple', 18, ['seedvolley', 'spark']), makeCreature('grovebeast', 18, ['bigbong', 'vinelash'])];
    g.party[1].hp = 1;
  });
  // Both stand on a little stone platform high in the air, so nothing is in the way.
  const stand = (page, dx) => page.evaluate(dx => {
    const g = window.pokecraft, s = g.spawnPoint, y = 42;
    for (let x = -2; x <= 5; x++) for (let z = -2; z <= 2; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
    g.player.pos.set(Math.floor(s.x) + 0.5 + dx, y + 1, Math.floor(s.z) + 0.5);
    g.player.vel.set(0, 0, 0);
  }, dx);
  await stand(A, 0);
  await stand(B, 3);
  await A.waitForTimeout(1500);
  await A.evaluate(() => {
    const g = window.pokecraft;
    const kid = [...g.mp.others.values()][0];
    g.player.lookAt(kid.pos.clone().setY(kid.pos.y + 1));
  });
  t.ok(await waitFor(A, () => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.player.lookAt(k.pos.clone().setY(k.pos.y + 1)); return document.getElementById('prompt').textContent.includes('Kid · click or E to play together'); }, 60000), // aim on every poll: Kid's avatar glides to its spot
    'looking at the other player shows "click or E to play together" (wave 17: the friend menu)');
  const teamA = await teamKey(A), teamB = await teamKey(B);
  const cubesA = await cubes(A), cubesB = await cubes(B);

  // Asking, and saying "Not now".
  await askBattle(A);
  t.ok(await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden')
    && document.getElementById('ask-text').textContent.includes('Dad wants')), 'the other player is asked "Dad wants to have a creature battle"');
  await click(B, '#ask-no');
  t.ok(await waitFor(A, () => !window.pokecraft.duels.asking), 'saying "Not now" tells the asker');
  t.ok(!(await inBattle(A)) && !(await inBattle(B)) && !(await askShown(B)), 'nobody is in a battle after "Not now"');

  // Asking again and saying yes, then a full battle. The kid has the team screen open (the invite
  // is drawn above it) and Dad has the Book open while waiting: both close when the battle starts.
  await B.keyboard.press('p');
  await askBattle(A);
  await A.keyboard.press('c');
  t.ok(await B.evaluate(() => window.pokecraft.ui.panelOpen) && await A.evaluate(() => window.pokecraft.ui.panelOpen), 'the kid has the team screen open, Dad the Book');
  await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden'));
  await click(B, '#ask-yes');
  t.ok(await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B), 'saying "Battle!" starts the battle for both players');
  t.ok(!(await B.evaluate(() => window.pokecraft.ui.panelOpen)) && !(await A.evaluate(() => window.pokecraft.ui.panelOpen)),
    'the team screen and the Book close when the battle starts');
  // A panel opened over a battle anyway can always be closed with its key.
  await B.evaluate(() => window.pokecraft.ui.openPanel('team'));
  await B.keyboard.press('p');
  t.ok(!(await B.evaluate(() => window.pokecraft.ui.panelOpen)), 'P closes a team screen left open over a battle');
  t.ok(await playDuel([A, B]), 'the battle finishes');
  const resA = await A.evaluate(() => window.pokecraft.duels.lastResult);
  const resB = await B.evaluate(() => window.pokecraft.duels.lastResult);
  t.ok([resA, resB].sort().join() === 'lost,won', `one player wins, the other loses (Dad: ${resA}, Kid: ${resB})`);
  const [W, L, cubesW, cubesL] = resA === 'won' ? [A, B, cubesA, cubesB] : [B, A, cubesB, cubesA];
  const hp = page => page.evaluate(() => ({ mine: window.pokecraft.battle.allies.map(c => c.hp), theirs: window.pokecraft.battle.foes.map(c => c.hp), log: window.pokecraft.battle.history.length }));
  const hA = await hp(A), hB = await hp(B);
  t.ok(hA.log > 5 && hA.log === hB.log, `both browsers logged the same number of battle lines (${hA.log} / ${hB.log})`);
  t.ok(JSON.stringify(hA.mine) === JSON.stringify(hB.theirs) && JSON.stringify(hA.theirs) === JSON.stringify(hB.mine),
    `both browsers agree on every creature's HP (${JSON.stringify(hA)} / ${JSON.stringify(hB)})`);
  t.ok(await cubes(W) === cubesW + 3 && await cubes(L) === cubesL, 'the winner gets 3 Capture Cubes, the other player loses none');
  t.ok(await teamKey(A) === teamA && await teamKey(B) === teamB, 'both teams are unchanged (no creatures lost, no XP)');
  t.ok(await B.evaluate(() => window.pokecraft.party[1].hp >= 1 && window.pokecraft.party[0].hp > 0), "the loser's real creatures were not hurt");

  // Accepting with the Y key, then giving up.
  const challenge = () => A.evaluate(() => { const g = window.pokecraft; g.duels.challenge([...g.mp.others.values()][0]); });
  await challenge();
  await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden'));
  await B.keyboard.press('y');
  t.ok(await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B), 'pressing Y accepts');
  await waitFor(B, () => [...document.querySelectorAll('#b-actions button')].some(b => b.textContent === 'Give up'), 30000);
  await B.evaluate(() => [...document.querySelectorAll('#b-actions button')].find(b => b.textContent === 'Give up').click());
  t.ok(await playDuel([A, B]), 'giving up ends the battle');
  const cubesNow = await cubes(A);
  t.ok(await A.evaluate(() => window.pokecraft.duels.lastResult) === 'won' && cubesNow === (resA === 'won' ? cubesA + 6 : cubesA + 3),
    'when the other player gives up you win 3 cubes');

  // Giving up while waiting for the other player.
  const startDuel = async () => {
    await challenge();
    await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden'));
    await B.keyboard.press('y');
    return await waitFor(A, () => window.pokecraft.inBattle) && await inBattle(B);
  };
  const waiting = page => waitFor(page, () => document.getElementById('b-log').textContent.startsWith('Waiting for')
    && [...document.querySelectorAll('#b-actions button')].some(b => b.textContent === 'Give up'), 30000);
  const pickMove = page => page.evaluate(() => document.querySelector('#b-actions button:not([disabled])').click());
  t.ok(await startDuel(), 'another battle starts');
  await waitFor(A, () => !!document.querySelector('#b-actions button small'), 30000);
  await pickMove(A);
  t.ok(await waiting(A), 'while waiting for the other player there is a "Give up" button');
  await A.evaluate(() => [...document.querySelectorAll('#b-actions button')].find(b => b.textContent === 'Give up').click());
  t.ok(await playDuel([A]) && await A.evaluate(() => window.pokecraft.duels.lastResult) === 'gaveup', 'pressing it ends the battle (you gave up)');
  t.ok(await playDuel([B]) && await B.evaluate(() => window.pokecraft.duels.lastResult) === 'won', 'and the other player wins');

  // The other player stops answering (here after 3 seconds instead of 90).
  await A.evaluate(() => { window.pokecraft.duels.waitTime = 3; });
  t.ok(await startDuel(), 'a third battle starts');
  await waitFor(A, () => !!document.querySelector('#b-actions button small'), 30000);
  await pickMove(A);
  const said = await A.evaluate(() => new Promise(resolve => {
    const log = document.getElementById('b-log');
    const ob = new MutationObserver(() => { if (log.textContent.includes('stopped answering')) { ob.disconnect(); resolve(true); } });
    ob.observe(log, { childList: true, characterData: true, subtree: true });
    setTimeout(() => resolve(false), 30000);
  }));
  t.ok(said, 'when the other player stops answering the battle says so');
  t.ok(await playDuel([A]) && await A.evaluate(() => window.pokecraft.duels.lastResult) === 'ended', 'and ends');
  t.ok(await playDuel([B]) && await B.evaluate(() => window.pokecraft.duels.lastResult) === 'ended', "the other player's battle ends too");
  await A.evaluate(() => { window.pokecraft.duels.waitTime = 90; });

  // An invite that arrives during another battle is answered "busy" and closed.
  await challenge();
  await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden'));
  await B.evaluate(async () => {
    const g = window.pokecraft;
    const S = await import('/src/species.js');
    const { Wild } = await import('/src/creatures.js');
    const wild = new Wild(S.makeCreature('fluffin', 2), S.buildModel('fluffin'), g.player.pos.clone().setX(g.player.pos.x + 3));
    wild.data.hp = 1;
    g.creatures.list.push(wild);
    g.startBattle({ wild });
  });
  t.ok(await inBattle(B) && !(await askShown(B)), 'starting another battle closes the invite');
  t.ok(await waitFor(A, () => !window.pokecraft.duels.asking), 'and tells the asker the other player is busy');
  t.ok(await playBattle(B), 'the other battle still works');

  // Leaving play-together stops waiting for an answer (no "didn't answer" later on the title screen).
  await challenge();
  await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden'));
  await A.evaluate(() => window.pokecraft.mp.close());
  t.ok(await A.evaluate(() => !window.pokecraft.duels.asking && !window.pokecraft.duels.incoming), 'closing play-together resets the battle invites');
  t.ok(await waitFor(B, () => document.getElementById('ask').classList.contains('hidden')), "and the other player's invite box closes");
  t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].join('; ')}`);
  await A.context().close(); await B.context().close();
}
