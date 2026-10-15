// Wild battle with mouse clicks, catching, then Esc -> Main menu -> New Game / Continue.
import { openGame, newGame, click, pause, continueGame } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  const state = () => page.evaluate(() => ({
    locked: document.pointerLockElement === document.getElementById('game'),
    pause: !document.getElementById('pause').classList.contains('hidden'),
    title: !document.getElementById('title').classList.contains('hidden'),
    started: window.pokecraft.started,
  }));
  await newGame(page, 0);
  t.ok((await state()).started, 'new game starts');

  // Battle the nearest wild creature with a strong lead, so we win.
  await page.evaluate(() => {
    const g = window.pokecraft;
    const w = g.creatures.list.sort((a, b) => a.pos.distanceTo(g.player.pos) - b.pos.distanceTo(g.player.pos))[0];
    g.party[0].level = 30; g.party[0].hp = 999;
    g.inBattle = true; document.body.classList.add('in-battle'); document.exitPointerLock();
    g.battle.start({ wild: w });
  });
  let sawContinue = false;
  for (let i = 0; i < 60 && !sawContinue; i++) {
    await page.waitForTimeout(800);
    const labels = await page.$$eval('#b-actions button:not([disabled])', bs => bs.map(b => b.textContent));
    if (!labels.length) continue;
    if (labels[0].startsWith('Continue exploring')) sawContinue = labels[0];
    await click(page, '#b-actions button:not([disabled])');
  }
  await page.waitForTimeout(1200);
  const after = await state();
  t.ok(sawContinue, 'battle ends with a "Continue exploring" button');
  t.ok(sawContinue && sawContinue.includes('You won!'), `the button says what happened (${sawContinue})`);
  t.ok(after.locked && !after.pause, 'after the battle you are straight back in the game (no pause screen)');

  // Catching: battle another creature and throw cubes until caught.
  const teamBefore = await page.evaluate(() => window.pokecraft.party.length);
  await page.evaluate(() => {
    const g = window.pokecraft;
    const w = g.creatures.list[0];
    w.data.hp = 1; g.cubes = 30;
    g.inBattle = true; document.body.classList.add('in-battle'); document.exitPointerLock();
    g.battle.start({ wild: w });
  });
  // Throw cubes until the "Continue exploring" button shows, then press Enter instead of clicking.
  let label = '';
  for (let i = 0; i < 200 && !label; i++) {
    label = await page.evaluate(() => {
      const c = document.querySelector('#b-actions button.continue');
      if (c) return c.textContent;
      const bs = [...document.querySelectorAll('#b-actions button:not([disabled])')];
      (bs.find(b => b.textContent.startsWith('Cube')) || bs[0])?.click();
      return '';
    });
    if (!label) await page.waitForTimeout(700);
  }
  t.ok(await page.evaluate(n => window.pokecraft.party.length > n, teamBefore), 'throwing Capture Cubes catches a creature');
  t.ok(label.includes('You caught'), `the button says what was caught (${label})`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.pokecraft.inBattle, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const afterKey = await state();
  t.ok(afterKey.locked && !afterKey.pause, 'pressing Enter continues, straight back in the game');

  // Pause -> Main menu -> New Game -> Continue.
  await pause(page);
  t.ok((await state()).pause, 'Esc shows the pause screen');
  const seed = await page.evaluate(() => window.pokecraft.world.seed);
  await click(page, '#menu');
  await page.waitForTimeout(2500);
  const menu = await state();
  t.ok(menu.title && !menu.started, 'Main menu returns to the title screen');
  await newGame(page, 1);
  t.ok(await page.evaluate(s => window.pokecraft.world.seed !== s && window.pokecraft.party[0].species === 'sproutle', seed), 'New Game from the menu makes a new world with the new starter');
  await pause(page);
  await click(page, '#menu');
  await page.waitForTimeout(2500);
  await continueGame(page);
  t.ok(await page.evaluate(() => window.pokecraft.started && window.pokecraft.party[0].species === 'sproutle'), 'Continue from the menu resumes the save');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
