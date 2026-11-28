// Bounce-Back for two in Node (no browser): the real BounceDuel (src/bounceduel.js) twice, one per computer, joined by a line with a delay,
// each driven by a model player of tests/bounceduelbots.mjs that sees only ITS OWN computer's court. Just enough of a game round each (no scene,
// a stand-in live part, a stand-in player); the heartbeat and the ticks run as friendgames.js runs them. tests/specs/friend-bounce.mjs uses it.
//   const r = await duelPair({ bots: ['tracker', 'still'], lag: 0.15, fps: 60 })  ->  { results, scores, ... }
import { register } from 'node:module';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));
if (typeof window === 'undefined') {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {} };
}

export async function duelPair({ bots = ['tracker', 'tracker'], lag = 0.15, fps = 60, budget = 240, drop = 0 } = {}) {
  const THREE = await import('three');
  const { BounceDuel } = await import('../src/bounceduel.js');
  const { DUEL_BOTS } = await import('./bounceduelbots.mjs');
  let now = 0, lost = 0, sent = 0;
  const lossy = (() => { let a = 12345; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; })();
  const sides = [0, 1].map(i => {
    const toasts = [], live = { duel: null, setDuel(d) { this.duel = d; } };
    const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, carry: null, keys: {} };
    const game = { mp: { id: i ? 'kid' : 'dad', name: i ? 'Kid' : 'Dad' }, gymLive: { of: () => live }, npcs: { list: [], sendAway() {}, placeAt() {} }, scene: null, camera: null,
      player, place: 'mirror', realms: { busy: false }, inBattle: false, ui: { toast: m => toasts.push(m) } };
    return { i, game, live, player, toasts, inbox: [], result: null, bot: DUEL_BOTS[bots[i]]() };
  });
  for (const S of sides) {
    const O = sides[1 - S.i];
    S.session = { leader: S.i === 0, partner: O.game.mp.id, partnerName: O.game.mp.name,
      send: data => { sent++; if (drop && lossy() < drop) { lost++; return; } O.inbox.push({ at: now + lag, data: JSON.parse(JSON.stringify({ ...data, from: S.game.mp.id, to: O.game.mp.id, name: S.game.mp.name })) }); }, // (as multiplayer.js sendPlay sends it)
      finish: text => { if (S.result == null) { S.result = text; S.play.end('done'); } } };
    S.play = new BounceDuel(S.game, S.session);
  }
  const [L, F] = sides;
  const startData = L.play.setup();
  L.play.start(startData);
  F.inbox.push({ at: now + lag, data: { type: 'start', data: startData } });
  const dt = 1 / fps;
  let beatAt = 0, tickAt = 0, started = false;
  const trace = { points: [], hits: [0, 0] };
  while (now < budget && !(L.result && F.result)) {
    now += dt;
    for (const S of sides) {
      while (S.inbox.length && S.inbox[0].at <= now) {
        const { data } = S.inbox.shift();
        if (S.result) continue;
        if (data.type === 'start') { S.play.start(data.data); started = true; }
        else if (data.type === 'beat') { if (started) S.play.heard(data.data); }
        else if (data.type === 'g' && (S.i === 0 || started)) S.play.message(data);
      }
      if (S.result || (S.i === 1 && !started)) continue;
      const c = S.play.court;
      S.play.input = S.bot(c, S.i, dt);
      const before = S.play.sc.score.join();
      S.play.update(dt);
      if (S.play.sc.score.join() !== before) trace.points.push({ side: S.i, t: +now.toFixed(2), score: S.play.sc.score.join() });
      trace.hits[S.i] = S.play.hits;
    }
    if (now - tickAt >= 0.5) { tickAt = now; for (const S of sides) if (!S.result && (S.i === 0 || started)) S.play.tick(); }
    if (now - beatAt >= 1) {
      beatAt = now;
      // the heartbeat; once the leader's game is over, friendgames.js answers the friend's messages with the game's last word (its tomb)
      const data = L.result ? (L.play.farewell() && { ...L.play.farewell(), type: 'g' }) : { type: 'beat', data: L.play.beat() };
      if (data && !F.result) { sent++; if (drop && lossy() < drop) lost++; else F.inbox.push({ at: now + lag, data }); }
    }
  }
  return { results: sides.map(S => S.result), scores: sides.map(S => S.play.sc.score.join()), time: +now.toFixed(2), sent, lost, trace,
    info: sides.map(S => S.play.info?.() ?? null), toasts: sides.map(S => S.toasts), players: sides.map(S => S.player) };
}
