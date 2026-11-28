// The Castle's games for two in Node (no browser): the real JoustDuel (src/joustduel.js) or ShieldDuel (src/siegeduel.js) twice, one per
// computer, joined by a line with a delay (and lost messages), each driven by a model player that sees only ITS OWN computer's game, like
// tests/bounceduelnode.mjs. Just enough of a game round each (no scene, a stand-in live part, a stand-in player); the heartbeat and the
// ticks run as friendgames.js runs them. tests/specs/friend-joust.mjs and friend-shield.mjs use it.
//   const r = await joustPair({ bots: ['skilled', 'still'], lag: 0.15, fps: 60 })  ->  { results, scores, ... }
//   const r = await shieldPair({ players: [['skilled', 'skilled'], ['still', 'spam']], lag: 0.15, fps: 60 })
import { register } from 'node:module';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));
if (typeof window === 'undefined') {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {} };
}

async function pairOf({ Game, lag, fps, budget, drop, drive, champ = true, seed = null, lineSeed = 12345 }) {
  const THREE = await import('three');
  let now = 0, lost = 0, sent = 0;
  const lossy = (() => { let a = lineSeed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; })();
  const sides = [0, 1].map(i => {
    const toasts = [], live = { duel: null, setDuel(d) { this.duel = d; }, callout() {}, setFov() {}, crosshair() {}, splatOn() {} };
    const player = { pos: new THREE.Vector3(80, 11, 140), vel: new THREE.Vector3(), yaw: 0, pitch: 0, carry: null, keys: {}, eye: 1.62 };
    const game = { mp: { id: i ? 'kid' : 'dad', name: i ? 'Kid' : 'Dad', role: i ? 'guest' : 'host', others: new Map() }, champion: champ, gymLive: { of: () => live }, npcs: { list: [], sendAway() {}, placeAt() {} }, scene: null, camera: null,
      player, place: 'castle', realms: { busy: false }, inBattle: false, ui: { toast: m => toasts.push(m) } };
    return { i, game, live, player, toasts, inbox: [], result: null };
  });
  for (const S of sides) {
    const O = sides[1 - S.i];
    S.session = { leader: S.i === 0, partner: O.game.mp.id, partnerName: O.game.mp.name,
      send: data => { sent++; if (drop && lossy() < drop) { lost++; return; } O.inbox.push({ at: now + lag, data: JSON.parse(JSON.stringify({ ...data, from: S.game.mp.id, to: O.game.mp.id, name: S.game.mp.name })) }); },
      finish: text => { if (S.result == null) { S.result = text; S.play.end('done'); } } };
    S.play = new Game(S.game, S.session);
  }
  const [L, F] = sides;
  const startData = L.play.setup();
  if (seed != null && 'seed' in startData) startData.seed = seed; // (the game's own seed is random: tests pin it)
  L.play.start(startData);
  F.inbox.push({ at: now + lag, data: { type: 'start', data: startData } });
  const dt = 1 / fps;
  let beatAt = 0, tickAt = 0, started = false;
  while (now < budget && !(L.result && F.result)) {
    now += dt;
    for (const S of sides) {
      while (S.inbox.length && S.inbox[0].at <= now) {
        const { data } = S.inbox.shift();
        if (S.result) continue;
        if (data.type === 'start') { if (!started) S.play.start(data.data); started = true; }
        else if (data.type === 'beat') { if (started) S.play.heard(data.data); }
        else if (data.type === 'g' && (S.i === 0 || started)) S.play.message(data);
      }
      if (S.result || (S.i === 1 && !started)) continue;
      drive(S, dt);
      S.play.update(dt);
    }
    if (now - tickAt >= 0.5) { tickAt = now; for (const S of sides) if (!S.result && (S.i === 0 || started)) S.play.tick(); }
    if (now - beatAt >= 1) {
      beatAt = now;
      const data = L.result ? (L.play.farewell() && { ...L.play.farewell(), type: 'g' }) : { type: 'beat', data: L.play.beat() };
      if (data && !F.result) { sent++; if (drop && lossy() < drop) lost++; else F.inbox.push({ at: now + lag, data }); }
    }
  }
  return { results: sides.map(S => S.result), time: +now.toFixed(2), sent, lost, sides,
    info: sides.map(S => S.play.info?.() ?? null), toasts: sides.map(S => S.toasts), players: sides.map(S => S.player) };
}

export async function joustPair({ bots = ['skilled', 'still'], lag = 0.15, fps = 60, budget = 200, drop = 0, seed = 7, lineSeed } = {}) {
  const { JoustDuel } = await import('../src/joustduel.js');
  const { JDUEL_BOTS } = await import('./joustduelbots.mjs');
  const made = bots.map(b => JDUEL_BOTS[b]());
  const r = await pairOf({ Game: JoustDuel, lag, fps, budget, drop, seed, lineSeed, drive: (S, dt) => {
    const pl = S.play;
    pl.input = pl.phase === 'pass' && pl.rider && !pl.rider.met ? made[S.i](pl.rider, pl.plan, S.i, { friendTip: pl.friendTip, dt }) : null;
  } });
  return { ...r, scores: r.sides.map(S => S.play.sc.score.join()), passes: r.sides.map(S => JSON.stringify(S.play.sc.passes)) };
}

export async function shieldPair({ players = [['skilled', 'skilled'], ['still', 'spam']], lag = 0.15, fps = 60, budget = 300, drop = 0, lineSeed } = {}) {
  const { ShieldDuel } = await import('../src/siegeduel.js');
  const { DEFENDERS, THROWERS } = await import('./siegeduelbots.mjs');
  const made = players.map(([d, t]) => ({ defend: DEFENDERS[d](), throw: THROWERS[t]() }));
  const r = await pairOf({ Game: ShieldDuel, lag, fps, budget, drop, lineSeed, drive: (S, dt) => {
    const pl = S.play, m = made[S.i];
    if (pl.role === 'def' && pl.turn) pl.input = m.defend(pl.turn, dt);
    else if (pl.role === 'throw' && pl.turn) { pl.input = null; const w = m.throw({ time: pl.clock, shield: pl.theirShield, thrown: pl.thrown, can: pl.canThrow() }); if (w) pl.throwNow(w); }
    else pl.input = null;
  } });
  return { ...r, scores: r.sides.map(S => S.play.sc.score.join()) };
}
