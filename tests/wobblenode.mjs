// Chapter 3, Slippy Lake in Node (no browser): the REAL Player and the REAL ScribbleFight on a stand-in world from wobbleLand.
//   ice:    walk on the lake and let go: you glide about 2 blocks (the same at 60 and 20 fps); riding an Ice creature you stop dead;
//           on the meadow's grass you stop at once, as everywhere else (world.groundAt answers null there)
//   chutes: step onto a chute's top and press nothing: it shoots you down onto the lake, the lead's current carries you to the east island
//   fight:  on the lake a creature that lets go glides on, an Ice creature stops dead; a slipping monster's charge (and its red line) goes
//           further; in the meadow a fight moves exactly as before (no rule)
//   node tests/wobblenode.mjs     (exit 1 on a problem); tests/specs/wobble.mjs part `ice` runs it
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));
globalThis.localStorage ??= { getItem: () => null, setItem() {} };

export async function wobbleEnv() {
  const { B, isSolid } = await import('../src/blocks.js');
  const L = await import('../src/wobbleland.js');
  const { Player } = await import('../src/player.js');
  const W = L.SIZE, D = L.SIZE, H = 48;
  const w = { W, D, H, data: new Uint8Array(W * D * H), ground: new Uint8Array(W * D), index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H, gravity: 1 };
  w.get = (x, y, z) => (w.inBounds(x, y, z) ? w.data[w.index(x, y, z)] : B.AIR);
  w.isSolid = (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z)));
  w.fenced = () => false; w.fenceAt = () => null;
  L.wobbleLand(w, { id: 'wobble', size: [W, D] });
  const player = new Player(w);
  const put = (x, y, z, yaw = 0) => { player.carry = null; player.ride = null; player.glide = null; player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.keys = {}; player.joy = null; player.yaw = yaw; player.update(1 / 60); };
  const run = (secs, fps, keys = {}) => { player.keys = { ...keys }; for (let t = 0; t < secs - 1e-9; t += 1 / fps) player.update(1 / fps); };
  return { B, L, w, player, put, run };
}

// walk north (yaw 0 = forward is -z) for `walk` s, let go, measure how far you go after letting go
function glide(E, { x, z, fps, ride = null, walk = 4 }) { // (4 s: near full speed, ice is slow to get going)
  const y = E.L.heightAt(x, z) + 1;
  E.put(x + 0.5, y, z + 0.5, 0);
  if (ride) E.player.ride = ride;
  E.run(walk, fps, { KeyW: true });
  const z0 = E.player.pos.z;
  E.run(5, fps, {});
  return +(z0 - E.player.pos.z).toFixed(2);
}
// a straight lane of open ice going north (no drift, log, rock, hole or island for `n` cells, three wide): where the glide is measured
function iceLane(E, n = 44) {
  const { L, w, B } = E, ice = (x, z) => w.get(x, L.LAKE.y, z) === B.ICE && w.get(x, L.LAKE.y + 1, z) === B.AIR;
  for (let z = 215; z > 80 + n; z--) for (let x = 6; x < 54; x++) {
    let ok = true;
    for (let k = 0; k < n && ok; k++) for (const dx of [-1, 0, 1]) if (!ice(x + dx, z - k)) { ok = false; break; }
    if (ok) return { x, z };
  }
  return null;
}

export async function checkIce() {
  const E = await wobbleEnv(), { L, B, w, player } = E, problems = [], out = {};
  const RIDE = { land: { kind: 'land', speed: 6.5, sprint: 8.5, jump: 9 } }; // (riding.js's numbers do not matter here: only the type)
  // 1. the slide on the lake (a lane of open ice), at 60 and 20 fps
  const lane = iceLane(E);
  if (!lane) return { problems: ['no lane of open ice 44 long on the lake'], out };
  out.lane = lane;
  out.glide60 = glide(E, { ...lane, fps: 60 });
  out.glide20 = glide(E, { ...lane, fps: 20 });
  if (Math.abs(out.glide60 - 3.9) > 0.6) problems.push(`on the ice a walk glides ${out.glide60} after letting go (want about 4)`);
  if (Math.abs(out.glide60 - out.glide20) > 0.15) problems.push(`the glide differs at 60 and 20 fps (${out.glide60} / ${out.glide20})`);
  out.sprint = (() => { E.put(lane.x + 0.5, L.LAKE.y + 1, lane.z + 0.5, 0); E.run(4, 60, { KeyW: true, ShiftLeft: true }); const z0 = player.pos.z; E.run(6, 60, {}); return +(z0 - player.pos.z).toFixed(2); })();
  // 2. riding an Ice creature: it keeps its grip; a Fire one slides
  out.iceRide = glide(E, { ...lane, fps: 60, walk: 2, ride: { ...RIDE.land, type: 'ice' } });
  out.fireRide = glide(E, { ...lane, fps: 60, walk: 2, ride: { ...RIDE.land, type: 'fire' } });
  if (out.iceRide > 0.15) problems.push(`riding an Ice creature still glides ${out.iceRide}`);
  if (out.fireRide < 1.5) problems.push(`riding a Fire creature glides only ${out.fireRide}`);
  // 3. the meadow's grass: you stop at once (no rule there), and the island's snow too
  out.meadow = glide(E, { x: 112, z: 196, fps: 60 });
  if (out.meadow > 0.1) problems.push(`on the meadow's grass a walk glides ${out.meadow}`);
  out.rule = { meadow: !!w.groundAt({ x: 112.5, y: L.heightAt(112, 196) + 1, z: 196.5 }), ice: w.groundAt({ x: lane.x + 0.5, y: L.LAKE.y + 1, z: lane.z + 0.5 })?.id, drift: !!w.groundAt({ ...(() => { for (let x = 4; x < 56; x++) for (let z = 80; z < 220; z++) if (L.lakeShape(x, z) <= 1 && L.driftAt(x, z) && w.get(x, L.LAKE.y, z) === B.SNOW) return { x: x + 0.5, z: z + 0.5 }; })(), y: L.LAKE.y + 1 }), isle: !!w.groundAt({ x: 52.5, y: L.LAKE.y + 2, z: 178.5 }) };
  if (out.rule.meadow || out.rule.ice !== 'ice' || out.rule.isle || out.rule.drift) problems.push(`groundAt: ${JSON.stringify(out.rule)}`);
  // 4. the chutes: step onto the top, press nothing: down the chute, into the lead, carried to the east island
  out.chutes = [];
  for (const c of L.CHUTES) for (const fps of [60, 20]) {
    E.put(c.x0 + 1, L.chuteFloor(c, c.z0) + 1, c.z0 + 0.5 + c.dir * 0.6, 0);
    let top = 0, t = 0, island = null;
    for (; t < 25 && !island; t += 1 / fps) {
      player.keys = {}; player.update(1 / fps);
      top = Math.max(top, Math.hypot(player.vel.x, player.vel.z));
      const i = L.LAKE.isles[0];
      if (Math.hypot(player.pos.x - i.x - 0.5, player.pos.z - i.z - 0.5) < i.r && player.onGround && player.pos.y >= L.LAKE.y + 1.9) island = +t.toFixed(1);
    }
    out.chutes.push({ from: `${c.x0},${c.z0}`, fps, top: +top.toFixed(1), island });
    if (island == null) problems.push(`the chute from ${c.x0}, ${c.z0} at ${fps} fps: never reached the island (at ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)})`);
  }
  // 4b. the lake's floating hill: its spring on the ice (Space, then W) lands you on top; a plain jump from the island never does
  {
    const f = L.FLOATERS.find(q => L.inLakeBox(q.x, q.z)), [sx, sz] = f.spring;
    E.put(sx + 0.5, L.heightAt(sx, sz) + 1, sz + 0.5, 0);
    E.run(0.1, 60, { Space: true }); E.run(4, 60, { KeyW: true });
    const top = player.onGround && player.pos.y >= f.y + 1 - 0.01 && Math.hypot(player.pos.x - f.x - 0.5, player.pos.z - f.z - 0.5) < f.r + 0.5;
    E.put(f.x + 0.5, L.LAKE.y + 2, f.z + 2.5, 0); let high = 0;
    for (let t = 0; t < 3; t += 1 / 60) { player.keys = { Space: true }; player.update(1 / 60); high = Math.max(high, player.pos.y); }
    out.spring = { top, plainJump: +high.toFixed(1), hill: f.y + 1 };
    if (!top || high >= f.y - 2) problems.push(`the lake's floating hill: ${JSON.stringify(out.spring)}`);
  }
  // 5. the fight: on the ice a Fire creature glides, an Ice creature stops dead; a slipping monster's red line is longer; the meadow is as before
  const SF = await import('../src/scribblefight.js'), S = await import('../src/species.js');
  const G = SF.groundOf(w), q = { ...L.patchOf(7), x: lane.x, z: lane.z - 22 }, pf = SF.patchFight(q, L.LAKE.y + 1); // (a ring on the lane of open ice)
  const fightGlide = (species, patch = pf) => {
    const F = new SF.ScribbleFight({ ground: G, centre: patch.centre, squad: [S.makeCreature(species, 30)], start: { x: patch.centre.x, y: patch.centre.y, z: patch.centre.z + 7 }, foes: patch.foes, rand: () => 0.5 });
    for (const f of F.foes) { f.timer = 99; f.sleepT = 99; f.x = patch.centre.x + 6; } // (the monsters wait, out of the way)
    F.input = { mx: 0, mz: -1 }; for (let i = 0; i < 100; i++) F.step(1 / 60);
    const z0 = F.you.z; F.input = { mx: 0, mz: 0 }; for (let i = 0; i < 180; i++) F.step(1 / 60);
    return +(z0 - F.you.z).toFixed(2);
  };
  out.fight = { fire: fightGlide('blazehound'), ice: fightGlide('glacieron') };
  const mq = L.patchOf(1), mpf = SF.patchFight(mq, L.heightAt(mq.x, mq.z) + 1);
  out.fight.meadow = fightGlide('blazehound', mpf);
  if (out.fight.fire < 2 || out.fight.ice > 0.05 || out.fight.meadow > 0.05) problems.push(`the fight's glide: ${JSON.stringify(out.fight)}`);
  {
    const F = new SF.ScribbleFight({ ground: G, centre: pf.centre, squad: [S.makeCreature('blazehound', 30)], start: { x: pf.centre.x, y: pf.centre.y, z: pf.centre.z + 4 }, foes: [{ species: 'shellby', pattern: 'charge' }, { species: 'frostling', pattern: 'charge' }], rand: () => 0.5 });
    const [water, ice] = F.foes; water.x = ice.x = pf.centre.x; water.z = pf.centre.z - 3; ice.z = pf.centre.z - 3; water.y = ice.y = pf.centre.y;
    out.lines = { slips: F.makeTell(water).len, grips: F.makeTell(ice).len };
    if (!(out.lines.slips > out.lines.grips + 1)) problems.push(`a slipping monster's red line (${out.lines.slips}) is not longer than an Ice one's (${out.lines.grips})`);
  }
  return { problems, out };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await checkIce();
  console.log(JSON.stringify(r.out, null, 1));
  for (const p of r.problems) console.log('PROBLEM', p);
  process.exit(r.problems.length ? 1 : 0);
}
