// Sound effects: breaking/placing blocks and battles make (quiet) sounds; the pause screen
// has a Sound on/off button that is remembered.
import { openGame, newGame, click, pause } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  const played = () => page.evaluate(() => [...window.pokecraft.sound.played]);
  const lookDown = () => page.evaluate(() => { const p = window.pokecraft.player; p.pitch = -0.75; p.keys = {}; });  // aim a little ahead, not under our feet
  // Stand on a stone platform high in the air, so nothing else (people, creatures, plants) is in the way.
  await page.evaluate(() => {
    const g = window.pokecraft, s = g.spawnPoint, y = 42;
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
    g.player.pos.set(Math.floor(s.x) + 0.5, y + 1, Math.floor(s.z) + 0.5);
    g.player.vel.set(0, 0, 0);
  });
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
  await page.evaluate(() => document.querySelector('#b-actions button:last-child')?.click()); // Run
  await page.waitForFunction(() => !window.pokecraft.inBattle, null, { timeout: 60000 }).catch(() => {});
  if (await page.evaluate(() => window.pokecraft.inBattle)) {
    await page.evaluate(() => { window.pokecraft.battle.active = false; });
  }

  // Sound-type creatures: their own tunes in battle, special move sounds, and singing in the wild.
  await page.evaluate(async () => {
    const g = window.pokecraft;
    const { makeCreature } = await import('/src/species.js');
    g.inBattle = false;
    g.party = [makeCreature('echobat', 20)];
    g.sound.played.length = 0;
    const p = g.player.pos;
    g.inBattle = true;
    g.battle.start({ trainer: { name: 'Tester', pos: p.clone().setX(p.x + 4) }, team: [['dinglet', 5]] });
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#b-actions button')].some(b => b.textContent.startsWith('Echo Ping')), null, { timeout: 60000 });
  await page.evaluate(() => [...document.querySelectorAll('#b-actions button')].find(b => b.textContent.startsWith('Echo Ping')).click());
  await page.waitForTimeout(3000);
  const p3 = await played();
  t.ok(p3.includes('cry:dinglet') && p3.includes('cry:echobat'), `sound-type creatures play their own tune when they come out (${p3.join(', ')})`);
  t.ok(p3.includes('echoping'), 'Echo Ping has its own sound');
  const sang = await page.evaluate(async () => {
    const g = window.pokecraft;
    const { Wild } = await import('/src/creatures.js');
    const { makeCreature, buildModel } = await import('/src/species.js');
    g.inBattle = false;
    const w = new Wild(makeCreature('gongolin', 5), buildModel('gongolin'), g.player.pos.clone().setX(g.player.pos.x + 3));
    w.songTimer = 0;
    g.creatures.list.push(w);
    g.sound.played.length = 0;
    await new Promise(r => setTimeout(r, 2500));
    return [...g.sound.played];
  });
  t.ok(sang.includes('cry:gongolin'), `a wild sound-type creature nearby sings (${sang.join(', ')})`);
  t.ok(await page.evaluate(() => {
    const s = window.pokecraft.sound;
    for (const n of ['bassblast', 'echoping', 'hit', 'badge']) s.play(n);
    for (const id of ['echobat', 'boomwing', 'drumbo', 'bongorilla', 'dinglet', 'gongolin']) s.cry(id, 'sound');
    return s.errors.length === 0;
  }), `all sounds play without errors ${await page.evaluate(() => window.pokecraft.sound.errors.join('; '))}`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
