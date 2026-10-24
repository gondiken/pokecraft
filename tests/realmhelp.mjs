// Shared by the realms specs (T31 realms, T38b realms-together): a finished cozy house and sleeping in its Bed.
import { waitFor } from './helpers.mjs';

// A cozy house on a stone slab at y = 42 near the start (all five features), your home, at night. Returns its cells.
export const HOUSE = async () => {
  const g = window.pokecraft, { B, WOOL } = await import('/src/blocks.js'), ht = await import('/src/hometypes.js');
  const s = g.spawnPoint, F = 42;
  const free = (x0, z0) => { for (let x = -2; x < 14; x += 3) for (let z = -2; z < 14; z += 3) for (let y = F; y <= F + 13; y += 3) if (g.world.protectedAt(x0 + x, y, z0 + z)) return false; return true; };
  let X0 = null, Z0 = null;
  search: for (let r = 0; r < 120; r += 8) for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const x = Math.floor(s.x) + 6 + dx, z = Math.floor(s.z) - 14 + dz;
    if (x > 2 && z > 2 && x < 200 && z < 200 && free(x, z)) { X0 = x; Z0 = z; break search; }
  }
  for (let x = -2; x < 14; x++) for (let z = -2; z < 14; z++) { g.world.set(X0 + x, F, Z0 + z, B.STONE); for (let y = 1; y <= 12; y++) g.world.set(X0 + x, F + y, Z0 + z, B.AIR); }
  const ex = ht.boxHouse({ w: 10, d: 10, wall: B.PLANKS, roof: B.PLANKS, floor: B.PLANKS });
  const at = (x, y, z, id) => g.world.set(X0 + x, F + y, Z0 + z, id);
  for (const [x, y, z, id] of ex.blocks) at(x, y, z, id);
  at(1, 1, 8, B.BED); at(5, 2, 9, B.FIREPLACE); at(5, 4, 5, B.LAMP); at(0, 2, 5, B.GLASS); at(9, 2, 5, B.GLASS);
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) at(5 + dx, 0, 4 + dz, WOOL.cozy);
  at(-1, 1, -1, B.BED); // a bed outside any home
  const mat = [X0 + ex.mat[0], F, Z0 + ex.mat[2]];
  g.homes.place(...mat);
  g.player.pos.set(X0 + 3.5, F + 1, Z0 + 6.5); g.player.vel.set(0, 0, 0);
  g.time = 0.75; // midnight
  window.__toasts = [];
  const toast = g.ui.toast.bind(g.ui);
  g.ui.toast = m => { window.__toasts.push(m); toast(m); };
  return { bed: [X0 + 1, F + 1, Z0 + 8], outside: [X0 - 1, F + 1, Z0 - 1], mat, edit: [X0 + 12, F, Z0 + 12] };
};

export const sleep = async (page, bed) => {
  await page.evaluate(b => { const g = window.pokecraft; g.realms.useBed({ x: b[0], y: b[1], z: b[2], id: 71 }); }, bed);
  const asked = await page.evaluate(() => window.pokecraft.ui.asking && document.getElementById('ask-text').textContent);
  await page.evaluate(() => window.pokecraft.ui.askYes());
  await waitFor(page, () => window.pokecraft.place === 'dream' && !window.pokecraft.realms.busy);
  return asked;
};

