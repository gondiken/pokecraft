// Sound effects: breaking/placing blocks and battles make (quiet) sounds; the pause screen
// has a Sound on/off button that is remembered.
import { openGame, newGame, click, pause } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  const played = () => page.evaluate(() => [...window.pokecraft.sound.played]);
  const lookDown = () => page.evaluate(() => { const p = window.pokecraft.player; p.pitch = -0.75; p.keys = {}; });  // aim a little ahead, not under our feet
  // Mouse input under pointer lock is covered by battle-and-menu; here, use the game's own
  // break/place actions. Software rendering is slow, so wait for the crosshair to find a block.
  for (let i = 0; i < 8 && !(await played()).includes('place'); i++) {
    await lookDown();
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const g = window.pokecraft;
      if (g.sound.played.includes('break')) g.placeBlock(); else g.breakBlock();
    });
  }
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
    const w = [...g.creatures.list].sort((a, b) => a.pos.distanceTo(g.player.pos) - b.pos.distanceTo(g.player.pos))[0];
    g.inBattle = true; document.body.classList.add('in-battle');
    g.battle.start({ wild: w });
  });
  await page.waitForTimeout(1500);
  t.ok((await played()).length === before, 'with sound off nothing plays');
  await page.evaluate(() => window.pokecraft.sound.setOn(true));
  await page.waitForSelector('#b-actions button', { timeout: 60000 });
  await page.evaluate(() => document.querySelector('#b-actions button').click());
  await page.waitForTimeout(4000);
  const p2 = await played();
  t.ok(p2.includes('hit') || p2.includes('super') || p2.includes('miss'), `battle moves make sounds (${p2.slice(before).join(', ')})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
