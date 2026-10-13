// Tablet controls on an emulated iPad: joystick + drag-look (multi-touch), buttons, team screen, pause.
import { devices } from 'playwright';
import { openGame } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await page.tap('text=New Game');
  await page.tap('.starter >> nth=0');
  await page.waitForTimeout(1500);
  t.ok(await page.evaluate(() => document.body.classList.contains('touch')), 'touch mode turns on');
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const center = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const before = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z, yaw: window.pokecraft.player.yaw }));
  const joy = await center('#joystick');
  await touch('touchStart', [[joy[0], joy[1], 1]]);
  await touch('touchMove', [[joy[0], joy[1] - 60, 1], [700, 300, 2]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[joy[0], joy[1] - 60, 1], [700 - i * 15, 300, 2]]); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
  await touch('touchEnd', []);
  const after = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z, yaw: window.pokecraft.player.yaw }));
  t.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.5, 'joystick walks');
  t.ok(Math.abs(after.yaw - before.yaw) > 0.1, 'dragging the right side looks around (at the same time)');
  // A battle (or menu) starting while the joystick and Jump are held resets them, so the next touch works.
  const jump = await center('#btn-jump');
  await touch('touchStart', [[joy[0], joy[1], 3], [jump[0], jump[1], 4]]);
  await page.waitForTimeout(200);
  t.ok(await page.evaluate(() => window.pokecraft.touch.joyId !== null && document.getElementById('btn-jump').classList.contains('down')), 'holding the joystick and Jump');
  await page.evaluate(() => window.pokecraft.touch.reset());
  t.ok(await page.evaluate(() => window.pokecraft.touch.joyId === null && !document.getElementById('btn-jump').classList.contains('down')), 'reset forgets the joystick finger and the Jump button');
  await touch('touchEnd', []);
  await page.evaluate(() => { const g = window.pokecraft; g.touch.joyId = 999; }); // as if a finger's "up" got lost
  await page.evaluate(() => window.pokecraft.touch.reset());
  const b2 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
  await touch('touchStart', [[joy[0], joy[1], 5]]);
  for (let i = 0; i < 6; i++) { await touch('touchMove', [[joy[0], joy[1] - 60, 5]]); await page.waitForTimeout(100); }
  await page.waitForTimeout(600);
  await touch('touchEnd', []);
  const a2 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
  t.ok(Math.hypot(a2.x - b2.x, a2.z - b2.z) > 0.3, 'after a reset the joystick walks again');
  await page.tap('.slot >> nth=4');
  t.ok(await page.evaluate(() => window.pokecraft.selected === 4), 'tapping the hotbar picks a block');
  await page.evaluate(() => { window.pokecraft.player.pitch = -1.2; });
  await page.waitForTimeout(300);
  await page.tap('#btn-break');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => window.pokecraft.world.edits.size > 0), 'Break button breaks a block');
  await page.tap('#btn-team');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => window.pokecraft.ui.panelOpen), 'Team button opens the team screen');
  await page.tap('#party-close');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !window.pokecraft.ui.panelOpen), 'Close button closes it');
  // Tapping the selected hotbar slot again opens the Blocks panel; picking a block fills that slot.
  await page.tap('#hotbar .slot.sel');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => !document.getElementById('blocks').classList.contains('hidden')), 'tapping the selected hotbar slot again opens the Blocks panel');
  await page.tap('#block-list button:has-text("Lamp")');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => !window.pokecraft.ui.panelOpen && document.querySelector('#hotbar .slot.sel').title === 'Lamp'), 'picking Lamp fills the slot and closes the panel');
  await page.tap('#btn-blocks');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => !document.getElementById('blocks').classList.contains('hidden')), 'Blocks button opens the Blocks panel');
  await page.tap('#blocks-close');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !window.pokecraft.ui.panelOpen), 'its Close button closes it');
  await page.tap('#btn-pause');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !document.getElementById('pause').classList.contains('hidden')), 'pause button pauses (and the tap does not instantly unpause)');
  await page.tap('#resume');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => document.getElementById('pause').classList.contains('hidden')), 'Resume button resumes');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
