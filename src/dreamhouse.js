// T35: the Upside-Down House, the Dream realm's gym (def.build 'dreamHouse', built by generateRealm through REALM_BUILDERS).
// A 13 x 13 house that floats above the gym island with its roof at the BOTTOM: you bounce up through a hole in its floor
// and walk on what is the house's ceiling. Furniture hangs from the real floor (now above your head), the front door is
// drawn upside down, and Healer Stella stands inside beside the hole. It writes only inside its own box.
import { B, WOOL } from './blocks.js';

export const HOUSE_R = 6;   // half size: 13 x 13
export const HOUSE_UP = 12; // the walking floor is this far above the island's top

export function buildDreamHouse(world, def, isles) {
  const isle = isles.list.find(i => i.id === isles.gym), hop = isles.list.find(i => i.id === 'hop2') || isles.list.find(i => i.id === isles.home);
  const gx = isle.x, gz = isle.z, R = HOUSE_R, top = isle.top, F = top + HOUSE_UP;
  const ax = hop.x - gx, az = hop.z - gz;
  const front = Math.abs(ax) >= Math.abs(az) ? [Math.sign(ax) || 1, 0] : [0, Math.sign(az) || 1]; // towards the island you come from
  const [fx, fz] = front;
  // local (d forward, s sideways) -> world column
  const at = (d, s) => [gx + fx * d - fz * s, gz + fz * d + fx * s];
  const put = (d, s, y, id) => { const [x, z] = at(d, s); world.set(x, y, z, id, false); };
  const inBox = (d, s, half) => Math.abs(d) <= half && Math.abs(s) <= half;

  // clear the whole box first (an island tree or a crystal must not poke through)
  for (let d = -R - 1; d <= R + 1; d++) for (let s = -R - 1; s <= R + 1; s++) for (let y = top + 1; y <= F + 8; y++) put(d, s, y, B.AIR);

  // the roof, at the bottom: a stepped pyramid pointing down (tip at F - 5)
  for (const [y, half] of [[F - 1, 6], [F - 2, 5], [F - 3, 4], [F - 4, 3], [F - 5, 1]]) {
    for (let d = -half; d <= half; d++) for (let s = -half; s <= half; s++) put(d, s, y, WOOL.dream);
  }
  // a brick chimney hanging down from the back of the roof, with two puffs of cloud below it
  for (let y = F - 3; y >= F - 7; y--) for (const [d, s] of [[-4, 0], [-3, 0], [-4, 1], [-3, 1]]) put(d, s, y, B.BRICK);
  for (const [d, s] of [[-4, 0], [-3, 1], [-4, 1]]) put(d, s, F - 8, B.CLOUD);
  put(-4, 0, F - 9, B.CLOUD);

  // the walking floor (the house's ceiling): dream wool with a pale ceiling rose near the back
  for (let d = -R; d <= R; d++) for (let s = -R; s <= R; s++) {
    const rose = Math.hypot(d + 3, s) <= 2.4 && Math.hypot(d + 3, s) >= 1.2;
    put(d, s, F, rose || (d + 3 === 0 && s === 0) ? WOOL.paper : WOOL.dream);
  }
  // walls F+1..F+5: planks with glass windows; the real floor (our ceiling) on top at F+6
  for (let d = -R; d <= R; d++) for (let s = -R; s <= R; s++) {
    const wall = Math.abs(d) === R || Math.abs(s) === R;
    for (let y = F + 1; y <= F + 5; y++) {
      if (!wall) continue;
      const along = Math.abs(d) === R ? s : d;
      const window = (y === F + 2 || y === F + 3) && [-3, 0, 3].includes(along) && !(d === R && Math.abs(s) <= 1);
      put(d, s, y, window ? B.GLASS : B.PLANKS);
    }
    put(d, s, F + 6, B.PLANKS);
  }
  // the front door, drawn upside down at the top of the front wall (door frame and a glass pane, sealed)
  for (let s = -1; s <= 1; s++) for (let y = F + 3; y <= F + 5; y++) put(R, s, y, s === 0 && y === F + 4 ? B.GLASS : B.LOG);

  // the entrance: a 3x3 hole through the floor and every roof layer, with a Bounce Block pad on the island right below
  const hole = [];
  for (let d = 2; d <= 4; d++) for (let s = -1; s <= 1; s++) {
    for (let y = top + 1; y <= F; y++) put(d, s, y, B.AIR);
    const [x, z] = at(d, s);
    world.set(x, top, z, B.BOUNCE, false);
    for (let y = top - 1; y > 0 && world.get(x, y, z) === B.AIR; y--) world.set(x, y, z, WOOL.sky, false);
    world.ground[x + z * world.W] = top;
    hole.push([x, z]);
  }
  const [hx, hz] = at(3, 0), pad = [hx, top, hz];

  // furniture hanging from the ceiling (all at F+4 or higher, so heads never bump), none above the entrance (d 1..5, s -2..2)
  const table = [[-2, -3], [-2, -2], [-1, -3], [-1, -2]];
  for (const [d, s] of table) put(d, s, F + 4, B.PLANKS);
  for (const [d, s] of [[-2, -3], [-1, -2]]) put(d, s, F + 5, B.LOG);
  for (const [d, s] of [[-3, -3], [-3, -2]]) { put(d, s, F + 5, B.LOG); put(d, s, F + 4, B.PLANKS); } // two chairs
  put(-5, 3, F + 5, B.BED); put(-5, -4, F + 5, B.FIREPLACE);
  for (let d = -4; d <= -2; d++) for (let s = 2; s <= 4; s++) put(d, s, F + 5, WOOL.pixie); // a rug on the ceiling
  // upside-down pictures: little wool pictures on the side walls, hanging low from the ceiling
  const pics = [[WOOL.fire, WOOL.electric, WOOL.water], [WOOL.grass, WOOL.pixie, WOOL.light]];
  pics.forEach((row, i) => row.forEach((id, k) => { put(-3 + i * 7 + 0, R - 1, F + 3 + (k % 2), id); put(-4 + i * 4, -(R - 1), F + 3 + ((k + 1) % 2), id); }));
  // the ceiling lamp stands UP from the floor in a corner
  put(-5, 5, F + 1, B.COBBLE); put(-5, 5, F + 2, B.LAMP);

  // people: the leader at the back, the two trainers on either side, Healer Stella beside the hole
  const stand = (d, s) => { const [x, z] = at(d, s); return [x + 0.5, F + 1, z + 0.5]; };
  const [sx, , sz] = stand(4, 4), [ox, , oz] = stand(3, 1);
  const healerHeading = Math.atan2(ox - sx, oz - sz);
  world.healer = [...stand(4, 4), healerHeading];

  const x0 = gx - R - 1, x1 = gx + R + 1, z0 = gz - R - 1, z1 = gz + R + 1;
  return {
    def, x: gx, z: gz, y: F + 1, front, isle: isle.id, pad, hole: [hx, F, hz],
    leaderPos: stand(-4, 0), trainerPositions: [stand(0, -3), stand(0, 3)],
    area: { x0: gx - R, x1: gx + R, z0: gz - R, z1: gz + R, y0: F + 1, y1: F + 5 },
    protect: [{ x0, x1, z0, z1, y0: F - 9, y1: F + 7 }],
  };
}
