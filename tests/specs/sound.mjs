// Sound effects: breaking/placing blocks and battles make (quiet) sounds; the pause screen
// has a Sound on/off button that is remembered.
import { openGame, newGame, click, pause } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  const played = () => page.evaluate(() => [...window.pokecraft.sound.played]);
  const lookDown = () => page.evaluate(() => { const p = window.pokecraft.player; p.pitch = -1.5; p.keys = {}; });
  await lookDown();
  await page.waitForTimeout(1500);
  await page.mouse.click(550, 380);
  await page.waitForTimeout(800);
  await page.mouse.click(550, 380, { button: 'right' });
  await page.waitForTimeout(800);
  const p1 = await played();
  t.ok(p1.includes('break') && p1.includes('place'), `breaking and placing blocks make sounds (${p1.join(', ')})`);
  t.ok(await page.evaluate(() => {
    const AC = window.AudioContext; return !!AC;
  }), 'the browser has Web Audio');

  await pause(page);
  t.ok((await page.textContent('#sound-btn')).includes('Sound on'), 'pause screen shows "Sound on"');
  await click(page, '#sound-btn');
  t.ok((await page.textContent('#sound-btn')).includes('Sound off') && await page.evaluate(() => localStorage.getItem('pokecraft-sound') === 'off'),
    'the button turns sound off and it is remembered');
  t.ok(await page.evaluate(() => !document.getElementById('pause').classList.contains('hidden')), 'clicking the sound button does not close the pause screen');
  const before = (await played()).length;
  await page.evaluate(() => {
    const g = window.pokecraft;
    const w = g.creatures.list[0];
    g.inBattle = true; document.body.classList.add('in-battle');
    g.battle.start({ wild: w });
  });
  await page.waitForTimeout(1500);
  t.ok((await played()).length === before, 'with sound off nothing plays');
  await page.evaluate(() => window.pokecraft.sound.setOn(true));
  await page.waitForSelector('#b-actions button', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('#b-actions button').click());
  await page.waitForTimeout(4000);
  const p2 = await played();
  t.ok(p2.includes('hit') || p2.includes('super') || p2.includes('miss'), `battle moves make sounds (${p2.slice(before).join(', ')})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
