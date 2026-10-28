// Wave 15 ships closed (src/comingsoon.js, owner 2026-10-27): without the switch the game is as before wave 15 for everyone;
// `?preview` opens the five worlds on that page only. The other specs play with the worlds open (helpers.openGame's `wave15`).
import { openGame } from '../helpers.mjs';

const state = page => page.evaluate(async () => {
  const P = await import('/src/pictureworlds.js'), R = await import('/src/realms.js'), L = await import('/src/playland.js'), C = await import('/src/comingsoon.js');
  const five = ['atlantis', 'portal', 'fair', 'doors', 'doodle'];
  return {
    switchOff: C.WAVE15_OPEN === false,
    ready: five.filter(id => P.pictureWorld(id)?.ready),
    oldReady: ['house', 'pirate', 'race', 'stadium'].filter(id => P.pictureWorld(id)?.ready),
    swirl: [R.REALMS.swirl.version, R.REALMS.swirl.house], pirate: [R.REALMS.pirate.version, ...R.REALMS.pirate.size],
    fair: !!L.PLAYLAND_PARTS.fair,
    castle: !!P.pictureWorld('castle')?.ready && !P.pictureWorld('castle')?.secret,
  };
});

export default async function ({ browser, base, t }) {
  const shut = await openGame(browser, base, { wave15: false });
  const a = await state(shut);
  t.ok(a.switchOff, 'the switch ships off (WAVE15_OPEN = false)');
  t.ok(a.ready.join() === 'atlantis,fair,doors,doodle' && a.oldReady.length === 4 && a.castle, `closed: of the five wave 15 worlds the Funfair, Atlantis, the Surprise Party and the Sketchbook are ready, and the Castle too (owner 2026-10-28: OPEN_NOW; only the Portal House waits), the four of wave 14 are (${a.ready})`);
  t.ok(a.swirl.join() === '4,false' && a.pirate.join() === '2,320,224' && a.fair, `closed: the Swirl is version 4 without the Portal House, the Pirate Seas version 2 (320 wide: Atlantis is open), the Funfair part is there (${a.swirl} / ${a.pirate} / ${a.fair})`);
  // the closed Swirl as a world: no House; Playland has the open Funfair
  const worlds = await shut.evaluate(async () => {
    const { World } = await import('/src/world.js'), { REALMS } = await import('/src/realms.js');
    const sw = new World(7, null, null, REALMS.swirl.size, REALMS.swirl); sw.generate();
    const pl = new World(7, null, null, REALMS.playland.size, REALMS.playland); pl.generate();
    return { house: !!sw.swirl.house, houseParts: (sw.parts || []).filter(p => p.id === 'portalhouse').length, sign: (pl.keeps || []).some(k => k.name === 'fair-sign'), fairPart: (pl.parts || []).some(p => p.id === 'fair') };
  });
  t.ok(!worlds.house && !worlds.houseParts, 'closed: the Swirl has no Portal House and no hub swirl part');
  t.ok(!worlds.sign && worlds.fairPart, 'the Funfair is open for everyone: no "Coming soon!" sign, the fair is built');
  t.ok(shut.errors.length === 0, `no page errors when closed (${shut.errors.slice(0, 3).join(' | ')})`);
  await shut.context().close();

  const pre = await openGame(browser, base, { wave15: false, query: '?preview' });
  const b = await state(pre);
  t.ok(b.ready.length === 5 && b.swirl.join() === '5,true' && b.pirate.join() === '2,320,224' && b.fair, `?preview: all five open, Swirl 5, Pirate Seas 2 (320 wide), the Funfair (${b.ready})`);
  const remembered = await pre.evaluate(() => Object.keys(localStorage).filter(k => /preview|wave15/i.test(k)));
  t.ok(remembered.length === 0, 'the preview is never remembered on the device');
  t.ok(pre.errors.length === 0, `no page errors in preview (${pre.errors.slice(0, 3).join(' | ')})`);
  await pre.context().close();
}
