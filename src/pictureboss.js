// T40: the Bosses of the Picture Worlds. Every Picture World ends with a Boss who gives the world's star (not a badge) and a short
// note from the Wizard. Once you hold the star the Boss offers rematches that grow like the gym rematches (T28). A Boss may have a
// crew: bonus battles (a gate before the Boss only where its `gate` says so: the Ball Stadium). The defs are data (`addBoss`, one per PICTURE_WORLDS id); the tasks add their own.
import { PICTURE_WORLDS, pictureWorld, loadStars } from './pictureworlds.js';
import { rematchTeam, rematchCubes } from './rematch.js';
import { REMATCH_CAP } from './gyms.js';
import { sound } from './sound.js';
import { goalState } from './stadium.js'; // T40d
import { boatState } from './pirateland.js'; // T40b
import { ticketState } from './funfair.js'; // T43
import { bowState } from './doorsland.js'; // T44

export const BOSS = { cubes: 10, xpBoost: 1.5, cap: REMATCH_CAP, crewCubes: 2, askTime: 20, askRange: 8, noteMs: 10000, maxWins: 999 };

// A Boss def (one per Picture World, keyed by its PICTURE_WORLDS id):
// { id, name, type, title?, colors: { shirt, pants, hair, skin }, hat?, cape?, look?,   // a person (buildPerson), or
//   model?: { species, scale },                                                       // a big creature (buildModel), e.g. a parrot captain
//   team: [[species, level, moves?], ...],          // the signature creature last; Step 0 top levels 62 / 63 / 64 / 65
//   intro: [lines], lose: 'said when you win', win: 'said when you lose', rematchIntro?: [lines],
//   note: "The Wizard's note: one or two short sentences",
//   gate?: game => null | 'what the Boss says instead of battling' (alias: ready),
//   crew?: [{ name, colors, look?, team, intro?, line }] }   // helpers, 2-4 levels below the Boss; optional unless `gate` asks for them (the Ball Stadium does)
export const BOSSES = {};
export function addBoss(def) { BOSSES[def.id] = { ...def, title: def.title ?? `${def.name} · ${pictureWorld(def.id).name} Boss` }; }
export const bossOf = id => BOSSES[id] ?? null;
export const crewKey = (id, i) => `pw:${id}:crew${i + 1}`;      // saved in `beaten` (strings, like trainer keys)

// The team for a star rematch after `wins` rematch wins (pure): the T28 growth with the crew's species as extras.
export function bossTeam(def, wins = null) {
  if (wins === null) return def.team;
  const gym = { id: def.id, type: def.type, leaderTeam: def.team, trainers: (def.crew || []).map(c => ({ team: c.team })) };
  return rematchTeam(gym, wins, { cap: BOSS.cap });
}

// bossWins from a save: { [Picture World id]: whole number > 0 }; unknown ids and junk dropped (old saves have none).
export function loadBossWins(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const w of PICTURE_WORLDS) {
    const n = saved[w.id];
    if (Number.isInteger(n) && n > 0) out[w.id] = Math.min(BOSS.maxWins, n);
  }
  return out;
}

const topLevel = team => Math.max(...team.map(t => t[1]));

// Stand-in Bosses with old species (each task replaces its own call with the real Boss).
const NOTE = 'Thank you! Every star makes my Swirl a little stronger. Bring me more!';
const PEOPLE = { shirt: 0xffffff, pants: 0x3a3a6a, hair: 0x6a3a1a, skin: 0xf2d0b0 };
addBoss({ id: 'house', name: 'Nibbles', title: "Nibbles · the Wizard's Mouse", type: 'tiny', look: 'mouse', // T40a: the Giant House
  colors: { shirt: 0xf2a6c0, pants: 0x8a8a96, hair: 0x9a9aa6, skin: 0xb8b8c4 }, // a pink apron, grey fur
  team: [['pipsqueak', 59], ['spoolmouse', 60], ['fluffnado', 61, ['swoop', 'bodyslam', 'cuphide', 'fluffstorm']], ['antlas', 62, ['buzzdive', 'bodyslam', 'antarmy', 'sugarlift']]], // the move lists are what movesWith(species, level, ...) gives (the tiny spec checks)
  intro: ['Squeak! You are as small as me now!', 'The Wizard gave me his star to look after.', 'Win it in a battle!'],
  lose: 'Squeak-tastic! You did it. The star is yours!',
  win: 'Good try! Have a crumb, rest a bit, and come back!',
  rematchIntro: ['Back again? My tiny team grew a little!'],
  note: 'Thank you for visiting my little mouse! Everything looks big when you are small, but small ones can do big things.' });
// T40b: Captain Squawk, a giant Featherbeard on his ship, and his crew (optional battles: Dot, Lou and First Mate Fin).
// Owner 2026-10-26: sink his 12 rowboats (four waves of three) with the deck cannons first (pirateparts.js; the sunk boats are saved `beaten` keys).
addBoss({ id: 'pirate', name: 'Captain Squawk', type: 'pirate', model: { species: 'featherbeard', scale: 2.2 },
  gate: game => { const { sunk, need, done } = boatState(game); return done ? null : `Squawk! Sink my ${need} rowboats first! (🚣 ${sunk} / ${need})`; },
  team: [['anchorclaw', 61, ['anchordrop', 'rumblerock', 'cannonball', 'hookswipe']], ['shipshape', 61],
    ['lookapus', 62, ['spyglass', 'soakshot', 'cannonball', 'walktheplank']],
    ['featherbeard', 63, ['broadside', 'swoop', 'jollyroger', 'cannonball']]], // top level 63, the easy side, four creatures
  intro: ['Squawk! You sank ALL my rowboats!', 'The star is in my treasure chest, and it stays there! Battle stations!'],
  lose: 'Squawk... you win, matey! My chest is yours. The star was in it all along!',
  win: 'Squawk! Good battle, matey. Have a rest and try again!',
  rematchIntro: ['You sank my new rowboats too? My crew trained all day. Squawk!'],
  note: 'Captain Squawk was my parrot. I painted him a whole sea to sail! When I left, he got a bit bossy. Thank you for the star!',
  crew: [
    { name: 'Deckhand Dot', look: 'pirate', colors: { shirt: 0xf6efe0, pants: 0x3a5aa8, hair: 0x7a3a1a, skin: 0xf2d0b0 },
      team: [['pinchook', 59], ['parroteer', 60]], intro: ['Ahoy! Nobody lands on Parrot Perch without a battle!'], line: 'The ropes take you to Lookout Isle. Swing!' },
    { name: 'Lookout Lou', look: 'pirate', colors: { shirt: 0xe07a6a, pants: 0x2a2a3a, hair: 0x1a1a1a, skin: 0xc68a5a },
      team: [['bottlet', 60], ['lookapus', 60]], intro: ['I saw you coming with my spyglass! Battle!'], line: 'That cannon shoots you right onto the ship!' },
    { name: 'First Mate Fin', look: 'pirate', colors: { shirt: 0x2a4aa8, pants: 0x3a2a1a, hair: 0xe0c060, skin: 0xf2d0b0 },
      team: [['parroteer', 60], ['anchorclaw', 61], ['shipshape', 61]], intro: ['The Captain is counting his gold. Battle me first, if you dare!'], line: 'Use the cannons on the rail. Sink the rowboats!' },
  ] });
addBoss({ // T40c: Racer Rio, the Race Track Boss (the race itself is in racelive.js; he battles after you win it)
  id: 'race', name: 'Racer Rio', type: 'racer', title: 'Racer Rio · Race Track Boss',
  colors: { shirt: 0xff8a2a, pants: 0x2a2a34, hair: 0x3a2418, skin: 0xf0c8a0 }, look: 'helmet',
  team: [['wheelie', 61], ['karthog', 62, ['pitcrew']], ['blastskate', 63], ['vroomster', 64, ['photofinish', 'fullthrottle']]],
  intro: ['Vroom! You beat me on the track...', "Now let's see if your team is fast too!"],
  lose: 'You beat me on the track AND in a battle! Hear that? Playland is waking up!',
  win: 'My racers are quick! Heal up and talk to me. No need to race again.',
  rematchIntro: ['Back for more? My team got even faster!'],
  note: 'I built this track for the festival race, but nobody ever raced on it. Thank you for racing!',
  crew: [
    { name: 'Pit Crew Pia', look: 'helmet', colors: { shirt: 0xffffff, pants: 0xff8a2a, hair: 0x2a1a10, skin: 0xd8a070 },
      team: [['vroomlet', 60], ['wheelie', 61]], intro: ['Want a practice battle before the big race?'], line: 'Go go go! Rio is fast, but you can do it!' },
    { name: 'Pit Crew Max', look: 'helmet', colors: { shirt: 0x2a8ae8, pants: 0xffffff, hair: 0xc89a40, skin: 0xf0c8a0 },
      team: [['zipskate', 60], ['pitpig', 61], ['blastskate', 62]], intro: ['Vroom vroom! Practice battle?'], line: 'Step on the boost pads. Zoom!' },
  ],
});
/* ==== T40d ball ==== */
addBoss({ // the Ball Stadium (Playland). Beat Wes and Hazel, score 3 goals and 3 baskets: the gate reads the saved keys (stadium.js goalState).
  id: 'stadium', name: 'Captain Kickley', type: 'ball', look: 'sport',
  colors: { shirt: 0x3a8cff, pants: 0xffffff, hair: 0x6a3a1a, skin: 0xf0c8a0 },
  gate: game => { // owner 2026-10-27: Wes and Hazel are trainers before the Captain (once), the goals and baskets come every match
    const { n, need, b, bneed, done, crew, ready } = goalState(game);
    if (ready) return null;
    const who = crew.map(i => BOSSES.stadium.crew[i].name).join(' and '), score = `(⚽ ${n} / ${need} · 🏀 ${b} / ${bneed})`;
    if (done) return `Great playing! Now beat ${who}. Then we battle!`;
    return crew.length ? `Score ${need} goals and ${bneed} baskets, and beat ${who}! Then we battle. ${score}` : `Score ${need} goals and ${bneed} baskets first! Then we battle. ${score}`;
  },
  team: [['smashbird', 62], ['beachboomer', 63], ['strikehorn', 63], ['goalhound', 65, ['goldengoal', 'cannonroll', 'quickpass', 'teamhuddle']]],
  intro: ['Three goals and three baskets! You can really play.', "Now let's see how your team plays!"],
  rematchIntro: ['Goals and baskets again! Ready for the second half?'],
  lose: 'What a match! The stadium is cheering again. Here is the star the Wizard hid in our trophy!',
  win: 'Good game! Score again and we play another match.',
  note: "This stadium was built for the festival's big match. Thank you for playing it!",
  crew: [
    { name: 'Winger Wes', colors: { shirt: 0x3a8cff, pants: 0xffffff, hair: 0x2a1a10, skin: 0xc68a5a }, look: 'sport',
      team: [['fuzzchick', 61], ['sealbop', 61], ['smashbird', 62]], intro: ["I'm the fastest winger in Playland!", 'Beat me before you battle the Captain!'],
      line: 'Run into the ball to dribble. Hold Kick! and let go when the ring is green!' },
    { name: 'Hoops Hazel', colors: { shirt: 0xf07a28, pants: 0x2a2a2a, hair: 0x1a1a1a, skin: 0xf2c79a },
      team: [['strikehorn', 62], ['beachboomer', 62], ['goalhound', 63]], intro: ['Nothing but net!', 'Beat me before you battle the Captain!'],
      line: 'Hold Shoot! next to the ball and let go at the top of your jump!' },
  ],
});
/* ==== end of T40d ball ==== */

/* ==== T43 funfair ==== */
addBoss({ // Merry Mae, the Fairkeeper, on the Star Stage (Playland's Funfair). Win three golden tickets at the games and ride the coaster up: the gate reads the saved keys (funfair.js ticketState).
  id: 'fair', name: 'Merry Mae', type: 'funfair', title: 'Merry Mae · the Fairkeeper', look: 'fair',
  colors: { shirt: 0xff7ac0, pants: 0xf6efe0, hair: 0xc8902a, skin: 0xf2d0b0 },
  gate: game => { const { n, done } = ticketState(game); return done ? null : `Win 3 golden tickets at the games! Then ride the coaster up to me. (🎟️ ${n} / 3)`; },
  team: [['candyram', 61], ['balloodle', 62], ['tixit', 63], ['galloprance', 64, ['colorsplash', 'bumperbash', 'funforall', 'grandgallop']]], // top level 64, the easy side; the move list is what movesWith(..., 'grandgallop', 'funforall', 'bumperbash') gives (the funfair spec checks)
  intro: ['Three golden tickets! You played every game!', 'Now for the best ride of all: a battle!'],
  lose: 'What a ride! Listen... the music is playing again! Here is the star.',
  win: 'Good try! Have some candy floss and try again.',
  rematchIntro: ['Back at the fair? The games got a bit harder!'],
  note: 'I built this fair for the festival, and nobody ever rode the carousel. Thank you for riding everything!',
  crew: [
    { name: 'Bumper Bea', colors: { shirt: 0xffd23a, pants: 0x3a4a8a, hair: 0x2a1a10, skin: 0xc68a5a }, look: 'fair',
      team: [['twistpup', 59], ['merrycolt', 60]], intro: ['Bump bump! Want a practice battle?'], line: 'Get behind a car and bump its balloon!' },
    { name: 'Bouncy Ben', colors: { shirt: 0x4aa8ff, pants: 0xffffff, hair: 0xe0b040, skin: 0xf0c8a0 }, look: 'fair',
      team: [['flufflamb', 60], ['balloodle', 61]], intro: ['Boing boing! Battle me!'], line: 'Hold Jump to bounce higher, let go to come down!' },
  ],
});
/* ==== end of T43 funfair ==== */
/* ==== T44 surprise ==== */
// Jolly Jax, a giant jack-in-the-box in the Big Gift of the Room of Doors, and two optional helpers behind surprise doors. The Big Gift opens
// only when the four golden bows are won (the Shuffle Stage x3 and the Pop-Up Room: doorslive.js); a won battle uses the bows up again.
addBoss({
  id: 'doors', name: 'Jolly Jax', title: 'Jolly Jax · Room of Doors Boss', type: 'surprise', model: { species: 'jestergrin', scale: 2.1 },
  gate: game => { const { n, need, done } = bowState(game); return done ? null : `Ho ho! My gift has ${need} ribbons. Win ${need - n} more golden ${need - n === 1 ? 'bow' : 'bows'} to untie them! (🎀 ${n} / ${need})`; },
  team: [['bowtower', 61], ['fiestallama', 62, ['sprinkles', 'surpriseparty', 'springpunch', 'candyburst']], ['partypop', 62], ['jestergrin', 63, ['shriek', 'surpriseparty', 'springpunch', 'tadaa']]], // top level 63, the easy side (the move lists are what movesWith(species, level, ...) gives: the surprise spec checks)
  intro: ['SURPRISE! Ho ho! You untied all my ribbons!', 'The Wizard put his star in my box. Win it!'],
  lose: 'Ho ho! What a surprise: you win! The star is yours.',
  win: 'Ho ho! Rest a bit and try again. I will still be in my box!',
  rematchIntro: ['Boing! New ribbons, new tricks. Ready?'],
  note: 'Jax was my favourite toy. I wrapped up gifts for every creature in the Swirl, but never got to give them out. Thank you for opening them!',
  crew: [
    { name: 'Ribbon Rosa', look: 'party', colors: { shirt: 0xe8384a, pants: 0xfff0d0, hair: 0x5a2a1a, skin: 0xf2c79a },
      team: [['giftle', 59], ['popjack', 60]], intro: ['Surprise! You found me! Battle!'], line: 'Keep your eyes on the bow when the doors shuffle!' },
    { name: 'Confetti Kit', look: 'party', colors: { shirt: 0x3a8ce8, pants: 0xffd23a, hair: 0xe8c03a, skin: 0xc68a5a },
      team: [['pinpop', 60], ['partypop', 61], ['bowtower', 61]], intro: ['Ta-da! A battle was behind the door!'], line: 'Boop the jacks fast!' },
  ],
});
/* ==== end of T44 surprise ==== */

export function createBosses(game, { startBattle, save }) {
  let pending = null; // { npc, at } while the rematch question is on screen
  const toast = m => game.ui.toast(m);
  const winsOf = id => game.bossWins[id] || 0;
  const hasStar = id => game.stars.includes(id);
  const defOf = npc => (npc.kind === 'crew' ? bossOf(npc.def?.boss) : bossOf(npc.def?.id));
  const dist = npc => Math.hypot(npc.pos.x - game.player.pos.x, npc.pos.z - game.player.pos.z);
  const usable = npc => game.npcs.list.includes(npc) && !game.inBattle;
  const gateText = def => (def.gate ?? def.ready)?.(game) ?? null;

  const api = {
    winsOf,
    get pending() { return pending; },

    // The player talked to a Boss or a crew person. Always handled (true).
    talk(npc) {
      const def = defOf(npc);
      if (!def) return true;
      if (npc.kind === 'crew') {
        const i = npc.def.index, crew = def.crew[i];
        if (game.beaten.includes(crewKey(def.id, i))) { toast(`${npc.name}: ${crew.line}`); return true; }
        startBattle({ trainer: npc, team: crew.team, intro: crew.intro || ['Get past me first!'], picture: { id: def.id, crew: i, rematch: null } });
        return true;
      }
      const why = gateText(def);
      if (why) { toast(`${npc.name}: ${why}`); return true; }
      if (!hasStar(def.id)) {
        startBattle({ trainer: npc, team: def.team, intro: def.intro, boss: true, xpBoost: BOSS.xpBoost, picture: { id: def.id, rematch: null } });
        return true;
      }
      if (game.duels?.incoming) { toast('Answer the battle question first!'); return true; }
      const wins = winsOf(def.id), top = topLevel(bossTeam(def, wins));
      pending = { npc, at: performance.now() };
      game.ui.ask({
        text: wins === 0 ? `${npc.name}: A rematch? My team trained too. Now they are up to level ${top}!`
          : `${npc.name}: Rematch number ${wins + 1}? You beat me ${wins} ${wins === 1 ? 'time' : 'times'}! My team is up to level ${top} now.`,
        yes: 'Battle!', no: 'Not now', kind: 'mine',
        onYes: () => api.accept(npc),
        onNo: () => { pending = null; toast(`${npc.name}: OK! Come back any time.`); },
      });
      return true;
    },
    accept(npc = pending?.npc) {
      pending = null;
      game.ui.closeAsk();
      if (!npc || !usable(npc) || dist(npc) > BOSS.askRange) return;
      const def = defOf(npc), wins = winsOf(def.id);
      startBattle({ trainer: npc, team: bossTeam(def, wins), intro: def.rematchIntro || ["Back again? Let's go!"], boss: true, xpBoost: BOSS.xpBoost, picture: { id: def.id, rematch: wins } });
    },

    // The words for the big action button: { verb, action } or null for people that are not mine.
    talkPrompt(npc) {
      if (npc.kind === 'crew') return game.beaten.includes(crewKey(npc.def?.boss, npc.def?.index)) ? { verb: 'talk', action: 'Talk' } : { verb: 'battle', action: 'Battle!' };
      if (npc.kind !== 'boss') return null;
      const star = hasStar(npc.def?.id);
      return { verb: star ? 'ask for a rematch' : 'challenge', action: star ? 'Rematch!' : 'Challenge!' };
    },

    // Battle end (main.js onBattleEnd): opts.picture = { id, crew?, rematch? }
    lost(npc) {
      const def = npc ? defOf(npc) : null;
      toast(`${npc?.name || 'Boss'}: ${def?.win || 'Good battle! Try again any time.'}`);
    },
    won(npc, opts) {
      const { id, crew } = opts.picture;
      const def = bossOf(id), pw = pictureWorld(id);
      if (!def || !pw) return;
      if (crew != null) { // a helper: a bonus battle (the Ball Stadium's gate also counts them)
        game.beaten.push(crewKey(id, crew));
        game.cubes += BOSS.crewCubes;
        sound.play('win');
        toast(`${npc.name}: Nice battle! +${BOSS.crewCubes} Capture Cubes`);
        return;
      }
      if (!hasStar(id)) { // the first win: the star, the Wizard's note
        game.stars = loadStars([...game.stars, id]);
        const c = def.cubes ?? BOSS.cubes;
        game.cubes += c;
        sound.play('champion');
        toast(`${npc.name}: ${def.lose}`);
        toast(`⭐ You won the star of the ${pw.name}! (${game.stars.length}/${PICTURE_WORLDS.length}) +${c} Capture Cubes`);
        game.ui.celebrate(`⭐ The ${pw.name} star!`, `🧙 "${def.note}"`, BOSS.noteMs);
        toast(`🧙 ${def.note}`);
        toast('Go back to the Swirl: your star lights a stone of the star bridge!');
        return;
      }
      const n = Math.min(BOSS.maxWins, winsOf(id) + 1); // a rematch
      game.bossWins[id] = n;
      const c = rematchCubes(n);
      game.cubes += c;
      sound.play('win');
      toast(`${npc.name}: Wow, you beat me again!`);
      const capped = bossTeam(def, n).every(t => t[1] >= BOSS.cap);
      toast(`Rematch win ${n}! +${c} Capture Cubes. ${capped ? "My team can't get any stronger. You are the best!" : 'Next time my team will be even stronger!'}`);
    },

    update() {
      if (!pending) return;
      const { npc, at } = pending;
      if (!game.ui.asking) { pending = null; return; }
      if (performance.now() - at > BOSS.askTime * 1000 || dist(npc) > BOSS.askRange || !usable(npc) || !game.started) api.close();
    },
    close() { pending = null; game.ui.closeAsk(); },
  };
  game.bosses = api;
  return api;
}
