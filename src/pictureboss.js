// T40: the Bosses of the Picture Worlds. Every Picture World ends with a Boss who gives the world's star (not a badge) and a short
// note from the Wizard. Once you hold the star the Boss offers rematches that grow like the gym rematches (T28). A Boss may have a
// crew: trainers before the Boss where its `gate` says so (the Ball Stadium, the Race Track, the Pirate Seas), bonus battles elsewhere. The defs are data (`addBoss`, one per PICTURE_WORLDS id); the tasks add their own.
import { PICTURE_WORLDS, pictureWorld, loadStars } from './pictureworlds.js';
import { rematchTeam, rematchCubes } from './rematch.js';
import { REMATCH_CAP } from './gyms.js';
import { sound } from './sound.js';
import { goalState } from './stadium.js'; // T40d
import { boatState } from './pirateland.js'; // T40b
import { roomState } from './portalplay.js'; // T42
import { ticketState } from './funfair.js'; // T43
import { bowState } from './partyland.js'; // T48
import { lightState, LIGHTS } from './glowfish.js'; // T41
import { lineState, LINE_COUNT } from './doodleland.js'; // T45
import { castleState } from './castleland.js'; // T49
import { bubbleState, SHIELDS as BUBBLE_SHIELDS } from './bubbleland.js'; // the Bubble Well
import { gravityState } from './cubeland.js'; // Cube Planets

export const BOSS = { cubes: 10, xpBoost: 1.5, cap: REMATCH_CAP, crewCubes: 2, askTime: 20, askRange: 8, noteMs: 10000, maxWins: 999,
  perStar: 2, starCap: 95 }; // owner 2026-10-28: every star you already hold makes the next Boss (and crew) 2 levels stronger, up to 95 (creatures now grow to 100)

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
// Owner 2026-10-27: on the Race Track and in the Pirate Seas the crew are trainers before the Boss too (beaten once, kept forever).
export const crewLeft = (game, id) => (BOSSES[id]?.crew || []).map((_, i) => i).filter(i => !game.beaten?.includes(crewKey(id, i)));
export const crewNames = (id, list) => list.map(i => BOSSES[id].crew[i].name).join(' and ');

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

// Owner 2026-10-28: "the Bosses should get slightly stronger from one to the next". The worlds can be done in any order, so the step
// comes from the stars you hold from OTHER worlds (a rematch of this world's Boss does not count its own star twice). Pure.
export const starBonus = (stars, id) => BOSS.perStar * (stars || []).filter(s => s !== id).length;
export function starTeam(team, stars, id) {
  const up = starBonus(stars, id);
  if (!up) return team;
  return team.map(([s, L, moves]) => { const lv = Math.max(L, Math.min(BOSS.starCap, L + up)); return moves === undefined ? [s, lv] : [s, lv, moves]; });
}

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
// T40b: Captain Squawk, a giant Featherbeard on his ship, and his crew (Dot, Lou and First Mate Fin).
// Owner 2026-10-26: sink his 12 rowboats (four waves of three) with the deck cannons first (pirateparts.js; the sunk boats are saved `beaten` keys).
// Owner 2026-10-27: and beat his three crew (once, kept forever).
addBoss({ id: 'pirate', name: 'Captain Squawk', type: 'pirate', model: { species: 'featherbeard', scale: 2.2 },
  gate: game => {
    const { sunk, need, done } = boatState(game), left = crewLeft(game, 'pirate');
    if (done && !left.length) return null;
    if (done) return `Squawk! You sank my rowboats, but ${crewNames('pirate', left)} still ${left.length === 1 ? 'wants' : 'want'} a battle! Beat ${left.length === 1 ? 'that one' : 'them'} first!`;
    return left.length ? `Squawk! Sink my ${need} rowboats and beat my crew first! (🚣 ${sunk} / ${need})` : `Squawk! Sink my ${need} rowboats first! (🚣 ${sunk} / ${need})`;
  },
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
  gate: game => { const left = crewLeft(game, 'race'); return left.length ? `Great race! Now beat ${crewNames('race', left)} in a battle. Then we battle!` : null; }, // owner 2026-10-27: the race (racelive.js) and the crew
  colors: { shirt: 0xff8a2a, pants: 0x2a2a34, hair: 0x3a2418, skin: 0xf0c8a0 }, look: 'helmet',
  team: [['wheelie', 61], ['karthog', 62, ['pitcrew']], ['blastskate', 63], ['vroomster', 64, ['photofinish', 'fullthrottle']]],
  intro: ['Vroom! You beat me on the track...', "Now let's see if your team is fast too!"],
  lose: 'You beat me on the track AND in a battle! Hear that? Playland is waking up!',
  win: 'My racers are quick! Heal up and talk to me. No need to race again.',
  rematchIntro: ['Back for more? My team got even faster!'],
  note: 'I built this track for the festival race, but nobody ever raced on it. Thank you for racing!',
  crew: [
    { name: 'Pit Crew Pia', look: 'helmet', colors: { shirt: 0xffffff, pants: 0xff8a2a, hair: 0x2a1a10, skin: 0xd8a070 },
      team: [['vroomlet', 60], ['wheelie', 61]], intro: ['Beat me before you battle Rio!'], line: 'Go go go! Rio is fast, but you can do it!' },
    { name: 'Pit Crew Max', look: 'helmet', colors: { shirt: 0x2a8ae8, pants: 0xffffff, hair: 0xc89a40, skin: 0xf0c8a0 },
      team: [['zipskate', 60], ['pitpig', 61], ['blastskate', 62]], intro: ['Vroom vroom! Beat me before you battle Rio!'], line: 'Step on the boost pads. Zoom!' },
  ],
});
/* ==== T40d ball ==== */
addBoss({ // the Ball Stadium (Playland). Beat Wes and Hazel, score 5 goals and 5 baskets: the gate reads the saved keys (stadium.js goalState).
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
  intro: ['Five goals and five baskets! You can really play.', "Now let's see how your team plays!"],
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
/* ==== T41 atlantis ==== */
addBoss({ // Queen Coralia in the palace of the Sunken City (in the Pirate Seas). The glowfish catch (atlantislive.js) lights the city; the 12 saved lights open the gate.
  id: 'atlantis', name: 'Queen Coralia', type: 'atlantis', look: 'crown',
  colors: { shirt: 0x3ab8b4, pants: 0x2a6a78, hair: 0x2a1a3a, skin: 0xe8c09a },
  gate: game => { const st = lightState(game); return st.done ? null : `The city is still dark! Light the three lanterns first. (💡 ${st.total} / ${LIGHTS})`; },
  team: [['grandurnling', 60], ['mosaicoil', 62], ['runestone', 62], ['guardlion', 64, ['sunkenbell', 'tiletoss', 'citywakes', 'ancientecho']]],
  intro: ['The lights are back! The whole city is awake!', 'My guardians want to meet the one who caught the glowfish.'],
  lose: 'Wonderful! The Sunken City shines again, and the star is yours!',
  win: 'My guardians are very old and very strong. Rest a little and try again!',
  rematchIntro: ['The glowfish got away again? You caught them all! Now, my guardians have been training!'],
  note: 'I painted the Sunken City from a dream about the sea. The glowfish were its lights, and I could never keep them. Thank you for catching them!',
  crew: [
    { name: 'Guard Pelos', colors: { shirt: 0xc4683f, pants: 0x6a3420, hair: 0x2a1a10, skin: 0xd8a070 }, hat: 0xd8b84a,
      team: [['jarling', 59], ['statuecub', 60]], intro: ['Halt! Nobody walks through the Jar Market without a battle!'], line: 'Bump a jar and be quick: a shy glowfish pops out!' },
    { name: 'Guard Talia', colors: { shirt: 0xd8cfb4, pants: 0x3ab8b4, hair: 0x6a3a1a, skin: 0xf0c8a0 }, hat: 0xd8b84a,
      team: [['tilesnek', 60], ['runestone', 61], ['grandurnling', 61]], intro: ['The temple is mine! Show me your team!'], line: 'Wait until the golden school bunches up. Then lunge!' },
  ],
});
/* ==== end of T41 atlantis ==== */

/* ==== T43 funfair ==== */
addBoss({ // Merry Mae, the Fairkeeper, on the Sky Stage (Playland's Funfair). Win three golden tickets at the games and ride the coaster up: the gate reads the saved keys (funfair.js ticketState).
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
// T48: Jolly Jax, a giant jack-in-the-box, throws the Surprise Party (it replaced T44's Room of Doors, keeping the id `doors`). He bursts out of
// the cake when the four golden bows of the four party games are won (partylive.js); his two helpers crash the party after the 1st and the
// 3rd bow and must be beaten before him. A won battle uses the bows up again (a rematch is a new party).
addBoss({
  id: 'doors', name: 'Jolly Jax', title: 'Jolly Jax · Surprise Party Boss', type: 'surprise', model: { species: 'jestergrin', scale: 2.1 },
  gate: game => { const { n, need, done } = bowState(game); return done ? null : `Ho ho! Win ${need - n} more golden ${need - n === 1 ? 'bow' : 'bows'} at my party games first! (🎀 ${n} / ${need})`; },
  team: [['bowtower', 61], ['fiestallama', 62, ['sprinkles', 'surpriseparty', 'springpunch', 'candyburst']], ['partypop', 62], ['jestergrin', 63, ['shriek', 'surpriseparty', 'springpunch', 'tadaa']]], // top level 63, the easy side (the move lists are what movesWith(species, level, ...) gives: the surprise spec checks)
  intro: ['SURPRISE! Ho ho! This party is for YOU!', 'The Wizard hid his star in my cake. Win it!'],
  lose: 'Ho ho! What a surprise: you win! The star is yours.',
  win: 'Ho ho! Have some cake, rest a bit and try again!',
  rematchIntro: ['Boing! A new party, new tricks. Ready?'],
  note: 'Jax was my favourite toy. I wrapped up gifts for every creature in the Swirl, but never got to give them out. Thank you for opening them!',
  crew: [
    { name: 'Ribbon Rosa', look: 'party', colors: { shirt: 0xe8384a, pants: 0xfff0d0, hair: 0x5a2a1a, skin: 0xf2c79a },
      team: [['giftle', 59], ['popjack', 60]], intro: ['Surprise! A party crasher! Battle!'], line: 'Spin the Party Spinner. Press Stop! when your game is under the arrow!' },
    { name: 'Confetti Kit', look: 'party', colors: { shirt: 0x3a8ce8, pants: 0xffd23a, hair: 0xe8c03a, skin: 0xc68a5a },
      team: [['pinpop', 60], ['partypop', 61], ['bowtower', 61]], intro: ['Ta-da! I crashed the party! Battle!'], line: 'Whack the jacks, but never the ones with a pie!' },
  ],
});
/* ==== end of T44 surprise ==== */
/* ==== T45 doodle ==== */
// Artist Arlo, the Sketchbook's Boss, waits on the Desk. His gate is the eight lines (saved `beaten` keys, doodleland.js lineState).
// Tracey and Charlie Charcoal are optional bonus battles.
addBoss({
  id: 'doodle', name: 'Artist Arlo', type: 'doodle', title: 'Artist Arlo · Sketchbook Boss', look: 'beret',
  colors: { shirt: 0xf4f0e6, pants: 0x4a4a56, hair: 0x5a4a3a, skin: 0xf2d0b0 },
  gate: game => { const st = lineState(game); return st.done ? null : `Hello! Draw all the lines to reach me first! (✏️ ${st.count} / ${LINE_COUNT})`; },
  team: [['notquite', 60], ['rubbadub', 61], ['graphitan', 62, ['leadlance']], ['outlynx', 63, ['squigglestrike', 'masterpiece']]],
  intro: ['Oh! You found my sketchbook!', 'Everything here is drawn, but not finished yet.', "Let's see how my drawings battle!"],
  lose: 'What a picture! The star is yours.',
  win: 'Good try! A drawing needs a few goes. Try again!',
  rematchIntro: ['Back again? I drew my team a bit bigger!'],
  note: 'My first sketchbook! I drew every creature here before I made them for real. Thank you for finishing the lines for me.',
  crew: [
    { name: 'Tracey', colors: { shirt: 0xf6d8e0, pants: 0x4a4a56, hair: 0x2a2a30, skin: 0xe8c09a },
      team: [['nibling', 59], ['sketchkit', 60], ['rubbit', 60]], intro: ['I trace everything!', 'Battle me!'], line: 'Follow the dots, and keep your eyes on the tip!' },
    { name: 'Charlie Charcoal', colors: { shirt: 0x4a4a56, pants: 0x2a2a30, hair: 0x1a1a1a, skin: 0xd8a878 },
      team: [['rubbit', 60], ['graphitan', 61]], intro: ['Smudge! Round and round we go!'], line: 'Round and round and up we go!' },
  ],
});
/* ==== end of T45 doodle ==== */

/* ==== T49 castle ==== */
// Sir Clanksalot, the Castle Champion, waits in the throne room beside the empty throne. His gate: Shield Up! and the Joust (three rounds
// each, saved `beaten` keys, castleland.js castleState); his helpers Squire Pip and Archer Wren battle first (the base's crew rule).
addBoss({
  id: 'castle', name: 'Sir Clanksalot', type: 'knight', title: 'Sir Clanksalot · Castle Boss', look: 'knight', // (the title is spelled out: a closed Castle's frame is named "Secret World")
  colors: { shirt: 0xd83a4a, pants: 0x8a8a96, hair: 0x3a2a1e, skin: 0xf2d0b0 },
  gate: game => { const st = castleState(game); return st.done ? null : `Halt! Block the pumpkins and win the joust first! (🛡️ ${st.shield} / 3 · 🐴 ${st.lance} / 3)`; },
  team: [['ramparsnail', 61], ['bristleguard', 62, ['seedvolley', 'bodyslam', 'holdthegate', 'quillvolley']], ['turrock', 63], ['gallantrot', 64, ['zoomdash', 'lancecharge', 'roundtable', 'grandjoust']]], // (the move lists are what movesWith gives: the spec checks)
  intro: ['Halt! Who goes there?', 'A challenger! At last! I have trained for this every day!'],
  lose: 'A true knight! The star is yours. Ta-ta-taa!',
  win: 'Bravely done! Rest a moment and try again.',
  rematchIntro: ['Back for another tournament? My knights trained harder!'],
  note: 'I built this castle for my toy knights. They trained every day for a tournament, and nobody ever came to watch. Thank you for being their challenger!',
  crew: [
    { name: 'Squire Pip', look: 'squire', colors: { shirt: 0x3a5ad8, pants: 0x6a4a2a, hair: 0xe0b04a, skin: 0xf2d0b0 },
      team: [['clipclop', 59], ['pricklet', 60]], intro: ['I look after the horses!', 'Battle me first!'], line: 'Point your lance at the gold star!' },
    { name: 'Archer Wren', look: 'squire', colors: { shirt: 0x4a8a3a, pants: 0x6a4a2a, hair: 0x8a3a1a, skin: 0xc68a5a },
      team: [['visnail', 60], ['bristleguard', 61]], intro: ['I load the catapults! Squishy pumpkins only.', 'Battle time!'], line: 'Push the stick toward the pumpkin! Jump for the sky ones!' },
  ],
});
/* ==== end of T49 castle ==== */

/* ==== Bubble ==== */
// Captain Suds, a giant Lathotter with a foam beard, sits on his foam throne on the rim of the Bubble Well, sealed in a big bubble that his
// five shield bubbles hold up (bubblelive.js; owner 2026-10-30: five, was three). His gate: his five shields, then the three stretches of the climb (the Fizz Ledges, the three ducklings, the Chimney Ride) (all saved
// `beaten` keys, bubbleland.js bubbleState); his crew Wanda Wand, Duckherd Daisy and Mate Fizz battle first (the base's crew rule).
addBoss({
  id: 'bubble', name: 'Captain Suds', type: 'bubble', title: 'Captain Suds · Bubble Well Boss', model: { species: 'lathotter', scale: 2.2 }, // (the title is spelled out: a closed well's frame is named "Secret World")
  gate: game => { // (owner 2026-10-30: he sits sealed in a big bubble while any shield is up: one line, in his own words, from inside it)
    const st = bubbleState(game);
    if (st.shields < BUBBLE_SHIELDS.length) return '(from inside his bubble) Hee hee! Nobody can pop my bubbles! ...unless they land on top. Oops!';
    return st.done ? null : `Ahoy-hoy! Climb the whole Bubble Well first! (🫧 ${st.n} / ${st.need})`;
  },
  team: [['fizzbomb', 61], ['quackmiral', 62, ['soakshot', 'bodyslam', 'fizzup', 'duckfleet']], ['bathemoth', 62, ['seedvolley', 'bodyslam', 'fizzup', 'bathtubwave']], ['lathotter', 63, ['foamcrash', 'bodyslam', 'fizzfest', 'soapjuggle']]], // top level 63, the easy side (the move lists are what movesWith gives: the spec checks)
  intro: ['Ahoy-hoy! You climbed my whole well and popped my shields!', 'Now, a bubbly battle!'],
  lose: 'Splish splash, you win! The star was in my bubble bath all along.',
  win: 'A good try, little bubble! Rest a bit and try again.',
  rematchIntro: ['Back up my well? My bubbles got bigger!'],
  note: 'I filled this well with fizz so my bath-time friends could float all the way up to the sky. Thank you for getting the bubbles rising again!',
  crew: [
    { name: 'Wanda Wand', look: 'bubble', colors: { shirt: 0x8ad8ff, pants: 0xf6efe0, hair: 0xe0a040, skin: 0xf2d0b0 },
      team: [['squeaklet', 59], ['suddly', 60]], intro: ['You climbed the Fizz Ledges! Pop!', 'Battle me!'], line: 'Hop off before your bubble pops!' },
    { name: 'Duckherd Daisy', look: 'bubble', colors: { shirt: 0xffd83a, pants: 0x6ab8e8, hair: 0x6a3a1a, skin: 0xc68a5a },
      team: [['hippip', 60], ['squeaklet', 61]], intro: ['My ducklings! Thank you for bringing them home.', 'Now a little battle?'], line: 'Stand close for a big puff!' },
    { name: 'Mate Fizz', look: 'bubble', colors: { shirt: 0xff9ac8, pants: 0x3a3a6a, hair: 0x1a1a1a, skin: 0xf0c8a0 },
      team: [['suddly', 60], ['fizzbomb', 61]], intro: ['Ahoy! Up the chimney already?', 'Battle stations!'], line: 'Big bubbles pop when you land on top!' },
  ],
});
/* ==== end of Bubble ==== */
/* ==== Gravity ==== */
// Professor Orbit waits on top of the Great Cube (his little-planet observatory) with his giant Saturnowl. His gate: the three Orbikit
// tags, the Planet Hop and the three telescope lenses (saved `beaten` keys, cubeland.js gravityState); his helpers Stargazer Stella,
// Captain Comet and Moon Mechanic Milo battle first (the base's crew rule). A won battle clears the seven keys (cubelive.js battleEnded):
// a rematch plays the games again, a bit harder. Redesign 2026-10-29: the story is told here (the helpers' words), never by rule text.
addBoss({
  id: 'gravity', name: 'Professor Orbit', type: 'gravity', title: 'Professor Orbit · Cube Planets Boss', look: 'orbit', // (the title is spelled out: a closed world's frame is named "Secret World")
  colors: { shirt: 0x4a3a8a, pants: 0x2a2a3a, hair: 0xe8e8f0, skin: 0xf2d0b0 },
  gate: game => { const st = gravityState(game); return st.done ? null : `Oh dear! My Orbikits got loose and my telescope lost its lenses! (🐱 ${st.tags} / 3 · 🌸 ${st.hop ? 1 : 0} / 1 · 🔭 ${st.lenses} / 3)`; },
  team: [['wallibex', 61], ['turvysloth', 62], ['orbitah', 62], ['saturnowl', 63]], // top level 63, the easy side
  intro: ['My Orbikits are home and my telescope can see again!', 'Now, a battle!'],
  lose: 'Marvellous! The star is yours. It was in orbit round my hat all along!',
  win: 'A fine try! Rest a moment, then come back for another go.',
  rematchIntro: ['Back again? My planets spin a little faster now!'],
  note: 'I made these little planets so my star creatures would have somewhere to play. Thank you for walking round every one of them!',
  crew: [
    { name: 'Stargazer Stella', look: 'orbit', colors: { shirt: 0x2a4a8a, pants: 0xf0d080, hair: 0x2a1a10, skin: 0xc68a5a },
      team: [['orbikit', 59], ['hootiter', 60]], intro: ['My Orbikits run round and round their planets!', 'They never see you round a corner. Battle!'], line: 'Round a corner it cannot see you!' },
    { name: 'Captain Comet', look: 'orbit', colors: { shirt: 0xe8e8f0, pants: 0x3a5ad8, hair: 0xe0a040, skin: 0xf2d0b0 },
      team: [['danglet', 60], ['orbikit', 61]], intro: ['Spring flowers! Boing! Your run flies with you.', 'Battle me!'], line: 'Stand, walk or run. Then jump!' },
    { name: 'Moon Mechanic Milo', look: 'orbit', colors: { shirt: 0xd8783a, pants: 0x4a4a56, hair: 0x1a1a1a, skin: 0xe8c09a },
      team: [['hootiter', 60], ['wallibex', 61], ['danglet', 61]], intro: ['My moon ferry never stops! Jump off and you keep its speed.', 'Battle!'], line: 'Let go early, like a sling!' },
  ],
});
/* ==== end of Gravity ==== */

/* ==== T42 portal ==== */
addBoss({ // the Portal House (in the Swirl itself): the eight swirl rooms open the Study; Grandpa Arch, the oldest Portal creature, battles for the star
  id: 'portal', name: 'Grandpa Arch', type: 'portal', model: { species: 'gatestrider', scale: 2.0 },
  gate: game => { const { n, need, ready } = roomState(game); return ready ? null : `Finish all the swirl rooms first! (🌀 ${n} / ${need})`; },
  team: [['peekhole', 60], ['topperoo', 61, ['hattrick', 'popthrough', 'shortcut', 'dizzyswirl']], ['loopwyrm', 62], ['gatestrider', 63, ['doorslam', 'popthrough', 'portalparty', 'shortcut']]], // top level 63, the easy side
  intro: ['Hello, little traveller. I am Grandpa Arch, the oldest Portal creature.', 'I have watched the crack in the Swirl for a long, long time. Show me your team!'],
  lose: 'Wonderful! Take the star. It will make the bridge a little longer.',
  win: 'A good try! Rest a bit, then come back through the swirls.',
  rematchIntro: ['Back again? My swirls trained too!'],
  note: 'The Portal creatures were my very first helpers. They built the door that let you in. Thank you for the star!',
  crew: [
    { name: 'Keeper Kit', look: 'swirl', colors: { shirt: 0x7a4ad8, pants: 0xf6efe0, hair: 0x2a1a4a, skin: 0xf2d0b0 },
      team: [['doorbit', 59], ['hatbun', 60]], intro: ['Hello! I keep the Hall of Swirls.', 'Want a practice battle?'], line: 'Your swirl and the orange swirl are joined: in one, out the other!' },
    { name: 'Keeper Juno', look: 'swirl', colors: { shirt: 0x2ab8b0, pants: 0x3a2a6a, hair: 0xf0a040, skin: 0xc68a5a },
      team: [['hooplet', 60], ['topperoo', 61]], intro: ['Quick taps! Look ahead while you fly!', 'Battle me first?'], line: 'Quick taps! Look ahead while you fly.' },
  ],
});
/* ==== end of T42 portal ==== */

export function createBosses(game, { startBattle, save }) {
  let pending = null; // { npc, at } while the rematch question is on screen
  const toast = m => game.ui.toast(m);
  const winsOf = id => game.bossWins[id] || 0;
  const hasStar = id => game.stars.includes(id);
  const defOf = npc => (npc.kind === 'crew' ? bossOf(npc.def?.boss) : bossOf(npc.def?.id));
  const dist = npc => Math.hypot(npc.pos.x - game.player.pos.x, npc.pos.z - game.player.pos.z);
  const usable = npc => game.npcs.list.includes(npc) && !game.inBattle;
  const gateText = def => (def.gate ?? def.ready)?.(game) ?? null;
  // Owner 2026-10-27: "all bosses should have previous battle conditions": every Boss with helpers battles only once they are beaten
  // (beaten once, kept forever; a gate may word it itself, like the Ball Stadium's).
  const crewText = def => { const left = crewLeft(game, def.id); return left.length ? `Beat ${crewNames(def.id, left)} first! Then we battle.` : null; };

  const api = {
    winsOf,
    // The guide in a Picture World whose Boss waits only for his helpers now (his own gate is passed): the nearest helper to beat, or null.
    crewAim(p) {
      const w = game.world, list = (w?.bosses || []).filter(b => !hasStar(b.id) && bossOf(b.id) && !gateText(bossOf(b.id)) && crewLeft(game, b.id).length);
      for (const b of list) {
        const left = crewLeft(game, b.id), people = game.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === b.id && left.includes(n.def.index));
        const c = people.sort((x, y) => Math.hypot(x.pos.x - p.x, x.pos.z - p.z) - Math.hypot(y.pos.x - p.x, y.pos.z - p.z))[0];
        if (c) return { x: c.pos.x, z: c.pos.z, text: (a, m) => `⚔️ Battle ${c.name} ${a} ${m}m` };
      }
      return null;
    },
    get pending() { return pending; },

    // The player talked to a Boss or a crew person. Always handled (true).
    talk(npc) {
      const def = defOf(npc);
      if (!def) return true;
      if (npc.kind === 'crew') {
        const i = npc.def.index, crew = def.crew[i];
        if (game.beaten.includes(crewKey(def.id, i))) { toast(`${npc.name}: ${crew.line}`); return true; }
        startBattle({ trainer: npc, team: starTeam(crew.team, game.stars, def.id), intro: crew.intro || ['Get past me first!'], picture: { id: def.id, crew: i, rematch: null } });
        return true;
      }
      const why = gateText(def) ?? crewText(def);
      if (why) { toast(`${npc.name}: ${why}`); return true; }
      if (!hasStar(def.id)) {
        startBattle({ trainer: npc, team: starTeam(def.team, game.stars, def.id), intro: def.intro, boss: true, xpBoost: BOSS.xpBoost, picture: { id: def.id, rematch: null } });
        return true;
      }
      if (game.duels?.incoming) { toast('Answer the battle question first!'); return true; }
      const wins = winsOf(def.id), top = topLevel(starTeam(bossTeam(def, wins), game.stars, def.id));
      pending = { npc, at: performance.now() };
      game.ui.ask({
        text: wins === 0 ? `${npc.name}: A rematch? My team trained too. Now they are up to level ${top}!`
          : `${npc.name}: Rematch number ${wins + 1}? You beat me ${wins} ${wins === 1 ? 'time' : 'times'}! My team is up to level ${top} now.`,
        yes: 'Battle!', no: 'Not now', kind: 'mine',
        onYes: () => api.accept(npc),
        onNo: () => { pending = null; toast(`${npc.name}: OK! Come back any time.`); game.gymLive?.bossDeclined?.(npc); },
      });
      return true;
    },
    accept(npc = pending?.npc) {
      pending = null;
      game.ui.closeAsk();
      if (!npc || !usable(npc) || dist(npc) > BOSS.askRange) return;
      const def = defOf(npc), wins = winsOf(def.id);
      startBattle({ trainer: npc, team: starTeam(bossTeam(def, wins), game.stars, def.id), intro: def.rematchIntro || ["Back again? Let's go!"], boss: true, xpBoost: BOSS.xpBoost, picture: { id: def.id, rematch: wins } });
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
        toast(game.place === 'swirl' ? 'Your star lights a stone of the star bridge, back on the hub!' : 'Go back to the Swirl: your star lights a stone of the star bridge!'); // T42: the Portal House is in the Swirl itself
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
    // Walking away or waiting too long is a "Not now" (T39b), so its onNo runs (the Race Track races again: gymLive.bossDeclined).
    close() { if (pending && game.ui.asking) game.ui.askNo(); pending = null; game.ui.closeAsk(); },
  };
  game.bosses = api;
  return api;
}
