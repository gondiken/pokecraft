// Swimming: holding forward + jump against a bank 1 block above the water climbs out onto it,
// a bank 2 blocks above the water can't be climbed, and swimming up still works.
// The physics run with a fixed time step (the game is paused), so the frame rate doesn't matter.
import { openGame, newGame, pause } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await pause(page);
  // A pool high in the air: floor at y = 39, water at 40-41 (surface at 42), stone walls around it,
  // and a bank to the east (+x) that is `bank` blocks above the water.
  const climb = (bank, dt = 1 / 60) => page.evaluate(async ([bank, dt]) => {
    const { B } = await import('/src/blocks.js');
    const g = window.pokecraft, w = g.world;
    const x0 = Math.floor(g.spawnPoint.x) - 3, z0 = Math.floor(g.spawnPoint.z) - 3, y = 39;
    for (let x = -1; x <= 9; x++) for (let z = -1; z <= 3; z++) for (let dy = 0; dy <= 6; dy++) w.set(x0 + x, y + dy, z0 + z, 0);
    for (let x = -1; x <= 9; x++) for (let z = -1; z <= 3; z++) {
      w.set(x0 + x, y, z0 + z, B.STONE);
      const wall = x === -1 || z === -1 || z === 3;
      for (let dy = 1; dy <= 4 && wall; dy++) w.set(x0 + x, y + dy, z0 + z, B.STONE);
      if (wall) continue;
      if (x <= 2) { w.set(x0 + x, y + 1, z0 + z, B.WATER); w.set(x0 + x, y + 2, z0 + z, B.WATER); }
      else for (let dy = 1; dy <= 2 + bank; dy++) w.set(x0 + x, y + dy, z0 + z, B.STONE);
    }
    const p = g.player;
    p.pos.set(x0 + 1.5, y + 1.2, z0 + 1.5);
    p.vel.set(0, 0, 0);
    p.yaw = -Math.PI / 2; // facing +x, towards the bank
    p.pitch = 0;
    p.joy = null;
    // Let the player float up first, then hold forward + jump.
    p.keys = {};
    for (let i = 0; i < 120; i++) p.update(1 / 60);
    const floating = p.inWater || w.get(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)) === B.WATER;
    p.keys = { KeyW: true, Space: true };
    for (let i = 0; i < 6 / dt; i++) {
      p.update(dt);
      if (p.pos.x - x0 > 3.6 && p.onGround) break; // made it: stop walking
    }
    p.keys = {};
    const top = y + 3 + bank; // the top of the bank
    return { floating, x: p.pos.x - x0, y: p.pos.y, top, onBank: p.pos.x - x0 > 3.3 && Math.abs(p.pos.y - top) < 0.01 };
  }, [bank, dt]);

  const one = await climb(1);
  t.ok(one.floating && one.onBank, `forward + jump climbs out onto a bank 1 block above the water (${JSON.stringify(one)})`);
  const level = await climb(0);
  t.ok(level.onBank, `and onto a bank level with the water (${JSON.stringify(level)})`);
  const two = await climb(2);
  t.ok(!two.onBank && two.x < 3, `a bank 2 blocks above the water can't be climbed (${JSON.stringify(two)})`);
  // The same at a slow frame rate (the game caps a frame at 0.05 s).
  const slow1 = await climb(1, 0.05), slow2 = await climb(2, 0.05);
  t.ok(slow1.onBank && !slow2.onBank, `at a slow frame rate too (${JSON.stringify([slow1, slow2])})`);
  // Swimming straight up (no wall) still just floats at the surface.
  const up = await page.evaluate(() => {
    const p = window.pokecraft.player;
    p.pos.set(p.pos.x - 1.2, 40.2, p.pos.z); p.vel.set(0, 0, 0);
    p.keys = { Space: true };
    let maxY = -1;
    for (let i = 0; i < 60 * 4; i++) { p.update(1 / 60); maxY = Math.max(maxY, p.pos.y); }
    p.keys = {};
    return maxY;
  });
  t.ok(up > 41 && up < 42.3, `swimming up without a wall doesn't launch the player (${up.toFixed(2)})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
