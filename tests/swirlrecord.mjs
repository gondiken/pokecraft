// Wave 18 (Mirror): the Swirl's data as a fixture. `node tests/swirlrecord.mjs > tests/fixtures/swirl-v5.json` was run on the code
// BEFORE the Mirror Palace existed; the removed state (REMOVED = ['mirror'], comingsoon.js) must give the same record again, block for
// block. Used by tests/specs/mirror.mjs (part `removed`). `snapshot(world)` only reads what swirlLand sets on a stand-in world.
import crypto from 'node:crypto';
import { makeSwirl } from './portalcheck.mjs';

export function snapshot(w = makeSwirl({ house: true })) {
  const S = w.swirl, boxes = a => a.map(b => b.box);
  return {
    sha: crypto.createHash('sha256').update(Buffer.from(w.data)).digest('hex'),
    ground: crypto.createHash('sha256').update(Buffer.from(w.ground)).digest('hex'),
    size: [w.W, w.D],
    decks: S.decks,
    lifts: w.lifts,
    frames: S.frames.map(f => ({ world: f.world, spot: f.spot, box: f.box })),
    stones: boxes(S.bridge).map((b, i) => ({ world: S.bridge[i].world, ...b })),
    wizard: { x: S.wizard.x, z: S.wizard.z, x0: S.wizard.x0, box: S.wizard.box },
    keeps: w.keeps.map(k => ({ name: k.name, protect: k.protect })),
  };
}
if (process.argv[1] && process.argv[1].endsWith('swirlrecord.mjs')) console.log(JSON.stringify(snapshot(), null, 1));
