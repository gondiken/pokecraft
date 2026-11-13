// Owner 2026-11-08: Easy / Normal / Hard (src/difficulty.js). Node: the three Difficulty objects, Normal is bit for bit the old kind
// help, Easy / Hard move every skill game through kindhelp.js at once, the hard limits hold on every level (a bubble never lifts 6,
// an Orbikit always outruns a sprint, the pebbles' pull), a rematch's `hard` stacks, duels are always Normal, battle numbers.
// Browser: the pause button cycles the level, it is saved and comes back after a reload, a trainer battle's levels and the catch chance
// follow it, a duel's do not. DIFFICULTY_ONLY=node|browser
import { DIFFICULTIES, NORMAL, Difficulty, difficultyOf, nextDifficulty, setDifficulty, battleLevel, DIFFICULTY, EASY_GAMES } from '../../src/difficulty.js';
import { KIND, KIND_HELP, kindHelp } from '../../src/kindhelp.js';
import { rideUp, bubbleHelp, BubbleField } from '../../src/bubbles.js';
import { gravityHelp, PAD_SCALE, PupRun } from '../../src/orbits.js';
import { PUPS, BOXES } from '../../src/cubeland.js';
import { bossSpeed, makeTrack } from '../../src/racetrack.js';
import { joustPlan } from '../../src/joust.js';
import { siegePlan } from '../../src/siege.js';
import { pinataPlan } from '../../src/pinata.js';
import { BumperGame } from '../../src/fairgames.js';
import { whackPlan } from '../../src/popupwhack.js';
import { setsOf } from '../../src/partyland.js';
import { boatAt } from '../../src/pirateland.js';
import * as Bt from '../partybots.mjs';
import * as CB from '../castlebots.mjs';
import * as MB from '../mirrorbots.mjs';
import { pinataRound } from '../../src/partyrounds.js';
import { BUG } from '../../src/scribblebugs.js';
import { playBugs } from '../wobblebugbots.mjs';
import { openGame, newGame, pause, click, continueGame } from '../helpers.mjs';

const SPRINT = 6.2; // player.js: a sprint on foot

export default async function ({ browser, base, t }) {
  const only = process.env.DIFFICULTY_ONLY;
  const was = DIFFICULTY.current;
  try {
    if (!only || only === 'node') node(t);
  } finally { setDifficulty(was); }
  if (!only || only === 'browser') await inBrowser(browser, base, t);
}

function node(t) {
  const [easy, normal, hard] = DIFFICULTIES;
  t.ok(DIFFICULTIES.every(d => d instanceof Difficulty) && DIFFICULTIES.map(d => d.id).join() === 'easy,normal,hard' && NORMAL === normal, 'three Difficulty objects: Easy, Normal, Hard');
  t.ok(difficultyOf('x') === normal && difficultyOf(undefined) === normal && difficultyOf('hard') === hard, 'junk or no level (old saves) = Normal');
  t.ok(nextDifficulty(easy) === normal && nextDifficulty(normal) === hard && nextDifficulty(hard) === easy, 'the button cycles Easy -> Normal -> Hard -> Easy');
  t.ok(DIFFICULTIES.every(d => d.label && d.line && d.line.length < 50), `short words for a child (${DIFFICULTIES.map(d => d.line).join(' / ')})`);

  // Normal = the old kind help exactly
  const M = Array.from({ length: 25 }, (_, m) => m);
  const old = m => (m < KIND_HELP.after ? 0 : Math.min(KIND_HELP.max, KIND_HELP.step * (m - KIND_HELP.after + 1)));
  setDifficulty('normal');
  t.ok(M.every(m => kindHelp(m).ease === old(m)) && KIND.level.base === 0, 'Normal: the kind help is exactly as before');
  const track = makeTrack(), rio = () => bossSpeed(50, 0, 0, track), shield = () => joustPlan(4, 2, 0).meet;
  const n = { rio: rio(), shield: shield(), life: new BubbleField().life };

  setDifficulty('easy');
  t.ok(kindHelp(0).ease > 0 && !kindHelp(0).on && kindHelp(20).ease <= KIND_HELP.max + easy.skill.extra + 1e-12, `Easy: easier from the first try (${kindHelp(0).ease}), up to ${kindHelp(20).ease} after misses, and the "a bit slower now" words still only after misses`);
  t.ok(rio() < n.rio && shield() > n.shield, `Easy: every game at once (Rio ${(rio() / n.rio).toFixed(2)} x, the Joust's meeting time ${(shield() / n.shield).toFixed(2)} x)`);
  const e = { rio: rio(), shield: shield() };
  setDifficulty('hard');
  t.ok(kindHelp(0).ease < 0 && rio() > n.rio && shield() < n.shield, `Hard: every game a bit faster (Rio ${(rio() / n.rio).toFixed(2)} x)`);
  t.ok(kindHelp(20).ease > kindHelp(0).ease && kindHelp(20).on, 'Hard: misses still help a little');
  t.ok(e.rio < n.rio && n.rio < rio(), 'Easy < Normal < Hard');

  // games whose obvious shortcut sits right at the edge keep Normal's numbers on every level (missHelp): the Piñata Party (mashing under
  // it), Bumper Cars (ramming), the Bubble Well's rim (a random hopper); Shield Up! too on Hard (a quicker one let a spinning stick win)
  const bump = () => { const g = new BumperGame(false); g.start(1); return [g.fleet.bots[3].speed, g.time]; };
  // (owner 2026-11-13: the piñata's swing stays, Easy only asks one CRACK fewer, so its hp is left out here and checked below)
  const same = () => JSON.stringify([{ ...pinataPlan(4, 2, 0), hp: 0 }, bump(), bubbleHelp(0, { plain: true })]);
  setDifficulty('normal'); const s0 = same(), sg0 = JSON.stringify(siegePlan(4, 2, 0)), pn = JSON.stringify(pinataPlan(4, 2, 0)); setDifficulty('easy'); const s1 = same(); setDifficulty('hard'); const s2 = same(), sg2 = JSON.stringify(siegePlan(4, 2, 0)), ph = JSON.stringify(pinataPlan(4, 2, 0));
  t.ok(s0 === s1 && s0 === s2 && sg0 === sg2 && pn === ph, 'the Piñata Party\'s swing, Bumper Cars and the Bubble Well rim are the same on every level, Shield Up! and the whole piñata on Normal and Hard');
  t.ok(!Object.keys(normal.games).length && !Object.keys(hard.games).length && JSON.stringify(easy.games) === JSON.stringify(EASY_GAMES), 'Easy\'s per-game extras (the Joust, the Moonlit Gallery, the Piñata Party) are Easy only');

  // owner 2026-11-13 ("still struggling ... Jousting, reflection hitting gloomies, Piñata"): Easy a bit easier for a struggling child
  // in those three, while the naive ways still lose. Rates over 20 seeds at 60 and 20 fps, Normal first.
  {
    const w20 = f => { let w = 0; for (let s = 1; s <= 20; s++) if (f(s)) w++; return w; };
    const joust = (bot, fps) => [0, 1, 2].map(r => w20(s => CB.playJoust(CB.JOUST_BOTS[bot](s), { seed: s, round: r, fps }).won));
    const world = MB.standInBeam(1), spot = (mk, fps) => [0, 1, 2].map(r => w20(s => MB.playSpot(mk(), { seed: s, round: r, fps, world }).won));
    const slowHerd = () => MB.SPOT_BOTS.person('herd', 0.7, 0.3);
    const pin = (kind, fps) => [1, 2, 3].map(r => w20(s => Bt.playPinata(kind, pinataRound(1000 + s, r, s, {}), 1 / fps).won));
    const all = () => [60, 20].map(fps => ({ sloppy: joust('sloppy', fps), surprised: joust('surprised', fps), jStill: joust('still', fps), jRand: joust('random', fps), jSkill: joust('skilled', fps),
      distracted: spot(MB.SPOT_BOTS.distracted, fps), slowHerd: spot(slowHerd, fps), sweep: spot(MB.SPOT_BOTS.sweeper, fps), sStill: spot(MB.SPOT_BOTS.still, fps), sSkill: spot(MB.SPOT_BOTS.skilled, fps),
      tablet: pin('tablet', fps), masher: pin('masher', fps), pStill: pin('still', fps), kid: pin('kid', fps) }));
    setDifficulty('normal'); const N = all(); setDifficulty('easy'); const E = all();
    const sum = (o, k) => o.reduce((a, x) => a + x[k].reduce((b, y) => b + y, 0), 0), show = (o, k) => o.map(x => x[k].join('/')).join(' at 60, ') + ' at 20';
    t.ok(E.every(x => x.sloppy[2] + x.surprised[2] >= 12) && N.every(x => x.sloppy[2] + x.surprised[2] <= 2) && E.every(x => x.jSkill.every(n => n === 20)),
      `the Joust on Easy: a child who does not lead the gold spot wins round 3 now and then (sloppy ${show(E, 'sloppy')}, late to see the turn ${show(E, 'surprised')} of 20; Normal ${show(N, 'sloppy')} / ${show(N, 'surprised')})`);
    t.ok(E.every(x => x.jStill.every(n => n === 0) && x.jRand[1] <= 3 && x.jRand[2] === 0), `the Joust on Easy: holding still never wins (${show(E, 'jStill')}), a random stick almost never (${show(E, 'jRand')})`);
    t.ok(sum(E, 'distracted') > sum(N, 'distracted') + 10 && sum(E, 'slowHerd') > sum(N, 'slowHerd') + 20 && E.every(x => x.sSkill.every(n => n === 20)),
      `the Moonlit Gallery on Easy: a distracted kid wins round 2 more often (${show(E, 'distracted')}; Normal ${show(N, 'distracted')}), a slow herder rounds 2 and 3 (${show(E, 'slowHerd')}; Normal ${show(N, 'slowHerd')})`);
    t.ok(E.every(x => x.sweep.every(n => n === 0) && x.sStill.every(n => n === 0) && x.distracted[2] === 0), `the Moonlit Gallery on Easy: sweeping or standing still never wins (${show(E, 'sweep')}, ${show(E, 'sStill')}), round 3 still needs a banked beam`);
    t.ok(sum(E, 'tablet') > sum(N, 'tablet') && E.every(x => x.kid.every(n => n === 20)) && E.every(x => x.pStill.every(n => n === 0) && x.masher[1] <= 3 && x.masher[2] <= 3),
      `the Piñata Party on Easy: a child on a tablet wins more (${show(E, 'tablet')}; Normal ${show(N, 'tablet')}); mashing under it still nearly never wins rounds 2 and 3 (${show(E, 'masher')}; Normal ${show(N, 'masher')}), standing still never`);
  }

  // owner 2026-11-08 ("genuinely difficult for my son on the tablet"): Easy gives the reaction games more time (react), and the naive
  // ways still do not win: rates over many seeds, a child on a tablet (late, a finger off the jack) against mashing / spinning
  const N = 40, rate = (f, n = N) => { let w = 0; for (let s = 0; s < n; s++) if (f(s)) w++; return Math.round(100 * w / n); };
  const sets = setsOf(), wb = sets.whack.boxes, eye = { x: sets.whack.standAt[0], y: 11 + Bt.EYE, z: sets.whack.standAt[1] };
  const whack = (kind, lvl) => [1, 2, 3].map(r => rate(s => Bt.playWhack(kind, whackPlan(100 + s, r, 0, { react: lvl.react, rest: lvl.rest }), 1 / 60, wb, eye).won));
  const siege = (kind, fps = 60) => [0, 1, 2].map(r => rate(s => CB.playSiege(CB.SIEGE_BOTS[kind](), { seed: s + 1, round: r, fps }).won));
  setDifficulty('normal'); const wN = { tab: whack('tablet', normal), mash: whack('masher', normal) }, sN = { slow: siege('slow'), spin: siege('spinner') };
  setDifficulty('easy'); const wE = { tab: whack('tablet', easy), mash: whack('masher', easy) }, sE = ['slow', 'spinner', 'still', 'jumpy'].map(k => [60, 20].map(f => siege(k, f)));
  t.ok(sE[0].every(l => l.every(x => x >= 95)) && sN.slow[2] < 50, `Shield Up! on Easy: a child who turns late (1.5 s) wins every round (${sE[0].map(l => l.join('/')).join(' at 60, ')} at 20 fps %; Normal ${sN.slow.join('/')} %)`);
  t.ok(sE[1].every(l => l.every(x => x <= 5)) && sE.slice(2).every(k => k.every(l => l.every(x => x === 0))), `Shield Up! on Easy: spinning the stick wins only by Normal's rare luck (at most 5 %), standing still or holding Jump never (${sE.slice(1).map(k => k.map(l => l.join('/')).join(' ')).join(', ')} %; Normal spinning ${sN.spin.join('/')} %)`);
  t.ok(wE.tab.every(x => x >= 95) && wN.tab[2] < 85, `Pop-Up Whack on Easy: a child on a tablet wins every round (${wE.tab.join('/')} %; Normal ${wN.tab.join('/')} %)`);
  t.ok(wE.mash.every((x, i) => x <= wN.mash[i]), `Pop-Up Whack on Easy: mashing wins no more than on Normal (${wE.mash.join('/')} %; Normal ${wN.mash.join('/')} %)`);
  setDifficulty('normal'); const bN = boatAt(0, 7); setDifficulty('easy'); const bE = boatAt(0, 7 * easy.react);
  t.ok(Math.abs(bN.x - bE.x) < 1e-9 && Math.abs(bN.z - bE.z) < 1e-9, 'the Pirate Seas rowboats row 1.4 x slower on Easy (the same figure eight)');
  // the hard limits, on every level and after any number of misses
  for (const d of DIFFICULTIES) {
    setDifficulty(d);
    const lift = Math.max(...M.map(m => rideUp(bubbleHelp(m).life)));
    const pup = Math.min(...PUPS.map(q => q.boost)) * Math.min(...M.map(m => gravityHelp(m).sprint));
    const pad = Math.max(...M.map(m => Math.max(gravityHelp(m).pad, gravityHelp(m).lens)));
    t.ok(lift < 6 && pup > SPRINT && pad <= KIND_HELP.max * PAD_SCALE + 1e-9 && pad >= 0,
      `${d.name}: a bubble lifts at most ${lift.toFixed(2)} (< 6), an Orbikit runs ${pup.toFixed(2)} (> your sprint ${SPRINT}), pebbles pull at most ${pad.toFixed(2)} further`);
    const q = PUPS[0], a = new PupRun(q.loop, BOXES[q.planet], { help: 0, hard: true }), b = new PupRun(q.loop, BOXES[q.planet], { help: 0 });
    t.ok(a.boost > b.boost, `${d.name}: a rematch (you hold the star) is still harder on top`);
  }

  // battles
  t.ok(battleLevel({ duel: { seed: 1 } }) === NORMAL && battleLevel({ duel: { coop: {} } }) === NORMAL, 'duels and co-op giants are always Normal');
  setDifficulty('easy'); t.ok(battleLevel({ wild: {} }) === easy && battleLevel({ team: [] }) === easy, 'battles against the game use the level');
  t.ok(normal.foeLevel(30) === 30 && normal.wildLevel(7) === 7 && normal.catchChance(0.4) === 0.4 && normal.battle.smart === 0.5, 'Normal battles: levels, catching and move picking as before');
  t.ok(easy.foeLevel(30) < 30 && easy.wildLevel(7) < 7 && easy.catchChance(0.4) > 0.4 && easy.battle.smart < 0.5, `Easy battles: trainers ${easy.foeLevel(30)} for 30, catching ${easy.catchChance(0.4).toFixed(2)} for 0.40, best move ${easy.battle.smart * 100} % of turns`);
  t.ok(hard.foeLevel(30) > 30 && hard.wildLevel(7) > 7 && hard.catchChance(0.4) < 0.4 && hard.battle.smart > 0.5, `Hard battles: trainers ${hard.foeLevel(30)} for 30, catching ${hard.catchChance(0.4).toFixed(2)}, best move ${hard.battle.smart * 100} %`);
  t.ok(easy.foeLevel(2) >= 1 && hard.foeLevel(99, 100) <= 100 && easy.catchChance(0.05) >= 0.05 && hard.catchChance(0.95) <= 0.95, 'levels stay 1..100, catching 5..95 %');

  // chapter 3 (owner 2026-11-12): the scribble fights and bugs follow the level (the fights' bots: tests/wobblebots.mjs with PC_DIFFICULTY)
  const sc = normal.scribble;
  t.ok(sc.levels === 0 && sc.tell === 1 && sc.rhythm === 1 && !Object.keys(normal.bugs).length, 'Normal scribble fights and bugs: exactly as before');
  t.ok(easy.scribble.tell > 1 && easy.scribble.levels === 0 && easy.scribble.rhythm === 1, `Easy scribble fights: warnings show ${easy.scribble.tell} x as long (earlier, the monsters move as on Normal), nothing a masher gains from`);
  t.ok(hard.scribble.levels > 0 && hard.scribble.tell === 1 && hard.scribble.rhythm < 1, `Hard scribble fights: monsters +${hard.scribble.levels} levels, attacks x${hard.scribble.rhythm} apart, warnings as long as on Normal (a child's reaction time)`);
  t.ok(DIFFICULTIES.every(d => (d.bugs.faster ?? BUG.faster) >= BUG.faster), 'a bug always runs at least Normal\'s 1.08 x faster than you on every level (chasing from behind never catches one)');
  const bugRun = level => JSON.stringify([0, 1, 2].map(seed => playBugs('kid', { seed, level })));
  t.ok(bugRun(normal) === bugRun({ bugs: null }), 'Normal bugs run bit for bit as before');
}

async function inBrowser(browser, base, t) {
  const page = await openGame(browser, base);
  await newGame(page);
  await pause(page);
  const label = () => page.locator('#level-btn').textContent();
  t.ok((await label()).includes('Normal') && await page.evaluate(() => window.pokecraft.difficulty.id) === 'normal', `a new game starts on Normal (${await label()})`);
  await click(page, '#level-btn');
  t.ok((await label()).includes('Hard'), `one tap: ${await label()}`);
  await click(page, '#level-btn');
  t.ok((await label()).includes('Easy'), `another tap: ${await label()}`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')).difficulty);
  t.ok(saved === 'easy', `it is saved at once (${saved})`);

  // a trainer battle and the catch chance follow the level
  const battle = async () => page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js');
    g.party = [S.makeCreature('fluffin', 40)];
    g.inBattle = true; document.body.classList.add('in-battle');
    document.getElementById('pause').classList.add('hidden');
    g.battle.start({ trainer: { name: 'Test', pos: g.player.pos.clone().setX(g.player.pos.x + 3) }, team: [['fluffin', 20]] });
    await new Promise(r => setTimeout(r, 300));
    const foe = g.battle.foes[0], lvl = foe.level, id = g.battle.level.id;
    const catchP = g.battle.catchChance();
    return { lvl, id, catchP };
  });
  const easy = await battle();
  t.ok(easy.id === 'easy' && easy.lvl === 17, `Easy: a Lv 20 trainer creature comes out at Lv ${easy.lvl}`);
  await page.reload();
  await page.waitForFunction(() => window.pokecraft?.world);
  await continueGame(page);
  t.ok(await page.evaluate(() => window.pokecraft.difficulty.id) === 'easy', 'after a reload the save is still on Easy');
  await pause(page);
  t.ok((await label()).includes('Easy'), `and the button says so (${await label()})`);
  await click(page, '#level-btn');
  await click(page, '#level-btn');
  const hard = await battle();
  t.ok(hard.id === 'hard' && hard.lvl === 23 && hard.catchP < easy.catchP, `Hard: Lv ${hard.lvl}, catching ${hard.catchP.toFixed(2)} (Easy ${easy.catchP.toFixed(2)})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 2).join(' | ')}`);
  await page.context().close();
}
