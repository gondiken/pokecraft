// Games for two friends in play together (owner 2026-11-26): tag anywhere, and football, basketball and a kart race in Playland.
// This file is the part every such game shares: asking a friend, yes / no, the start, the leader's heartbeat, stop, leaving.
// One play-together event, `play` (old games never subscribe to it; PLAY.VERSION is checked in the ask). The inviter LEADS
// (the clock and the score are the leader's, like hide and seek). Nothing is saved; no world block changes.
//
// Both sides must always agree that a game is on (owner 2026-11-27: "he looked like IT on my screen" while his tablet was not
// playing). So no single message is trusted to arrive: the leader's heartbeat carries the start again (a lost `start` heals),
// the friend answers every heartbeat (`pong`: a leader left alone notices), anything that arrives for a game this side does
// not have is answered with "gone" (the other side stops within a second or two), and a game that ended by its own rules
// repeats its last word for a while (a lost result still arrives).
//
// A kind's `place` may be 'main' too (the Parkour race on the Obstacle Course): the trip goes home to the main world (where you left
// it); the kind's own start() puts both on their start spots, there or when nobody had to travel.
//
// A kind with a `place` (owner 2026-11-28: football, basketball and the kart race live in Playland) can be asked for ANYWHERE
// once the host has finished chapter 1 (the Champion's title: `game.champion`, a guest reads the host avatar's `champ`): both
// say yes, both TRIP to the host's Playland (realms.js `trip` / `tripFollow`: the host goes first with its own world, the guest
// follows), the game starts when both are there, and when it ends, however it ends, both are taken back to the very spot they
// stood on. `s.started` = the kind's own game runs (before it: "Off to the Ball Stadium..."); every kind hook waits for it.
//
// A game KIND is one entry in FRIEND_GAMES (addFriendGame): { id, icon, name, sub, ask(name), shown(game), whyNot(game, avatar),
// make(game, session) -> a FriendGame }. A new game for two = one FriendGame subclass + one addFriendGame. Nothing here knows a kind.
import { sound } from './sound.js';
import { el } from './util.js';

export const PLAY = { VERSION: 4, answer: 30, beat: 1, lost: 10, probe: 2.5, tomb: 30, near: 30, toastGap: 3, tripLost: 60, tripMax: 60, tripTries: 4, tripWait: 1.5 };
export const FRIEND_GAMES = {}; // id -> def, in the friend menu's order
export const addFriendGame = def => { FRIEND_GAMES[def.id] = def; return def; };

const newId = () => Math.random().toString(36).slice(2, 10);

// One running game for two. The leader's setup() result is the start both sides get; `say` goes to the partner's message().
export class FriendGame {
  constructor(game, session) { this.game = game; this.s = session; }
  get me() { return this.game.mp.id; }
  get leader() { return this.s.leader; }
  get partner() { return this.s.partner; }
  get partnerName() { return this.s.partnerName; }
  get myName() { return this.game.mp.name; }
  nameOf(id) { return id === this.me ? this.myName : this.partnerName; }
  avatar() { return this.game.mp.others.get(this.s.partner); }
  say(data) { this.s.send({ ...data, type: 'g' }); }
  finish(text) { this.s.finish(text); }          // the game is over by its own rules (both sides call it on the same message)
  toast(m) { this.game.ui.toast(m); }
  /* ---- what a kind may define ---- */
  setup() { return {}; }                          // leader: the start data
  start() {}                                      // both: begin with the start data
  message() {}                                    // a `say` from the partner
  beat() { return null; }                         // leader: the whole state once a second (a lost message heals)
  farewell() { return null; }                     // leader: the last word of a finished game (`say` data), repeated if the friend missed it
  aim() { return null; }                          // the guide arrow while the game runs: { x, z, text(arrow, metres) } or null
  get usesFriend() { return false; }              // true = looking at / tapping the friend is part of the game (tag)
  heard() {}                                      // the other side: that state
  update() {}                                     // every frame (dt = real seconds)
  tick() {}                                       // twice a second, also while the game is paused
  end() {}                                        // clean up: 'done' | 'stopped' | 'left' | 'lost' | 'reset'
  fence() {}                                      // right after the player moved: (pos, before, vel)
  chip() { return null; }                         // { score, phase } for the corner
  tag() { return false; }                         // E / a tap on the partner: true = handled (no friend menu)
  prompt() { return null; }
  action() { return null; }
  get frozen() { return false; }                  // true = the player does not move at all
  get noRide() { return 'No riding in this game!'; }
}

export function createFriendGames(game) {
  let s = null;          // the running session: { id, kind, def, leader, partner, partnerName, play, heardAt, beatAt }
  let asking = null;     // { id, kind, to, name, timer }
  let incoming = null;   // { id, kind, from, name, timer, onYes }
  let pending = null;    // { id, kind, from, name, timer }: I said yes and wait for the start
  let tomb = null;       // { id, partner, data, at }: the game that just ended by its own rules
  const goneAt = {};     // id -> when I last answered "gone" for it
  let returning = null;  // { to, t0, ... }: a game with a trip is over and I am on my way back to where I was
  let last = performance.now(), hudAt = 0;
  const lastToast = { battle: 0, ride: 0 };
  const now = () => performance.now();
  const send = (to, data) => game.mp.sendPlay(to, data);
  const avatarOf = id => game.mp.others.get(id);
  const near = a => !!a && a.here !== false && a.pos.distanceTo(game.player.pos) <= PLAY.near;

  const busy = () => !game.started || game.inBattle || !!s || !!asking || !!incoming || !!pending || game.ui.asking
    || !!game.duels?.incoming || !!game.duels?.asking || !!game.duels?.current || !!game.hideSeek?.active || !!game.swaps?.session || !!game.realms?.busy;

  /* ---- a kind that lives in one place, asked for somewhere else: the trip there and back ---- */
  const isHost = () => game.mp.role === 'host';
  // The host finished chapter 1 (the Champion's title opens the Portal Door, and so Playland).
  const hostDone = () => (isHost() ? !!game.champion : !!game.mp.hostAvatar?.champ);
  const away = def => !!def.place && (game.place || 'main') !== def.place;
  const canGo = def => away(def) && hostDone() && typeof game.realms?.trip === 'function';
  const shown = def => !def.shown || def.shown(game) || canGo(def);
  // Where I stand now, exactly: the way back.
  const here = () => { const p = game.player; return { place: game.place || 'main', pos: [p.pos.x, p.pos.y, p.pos.z, p.yaw, p.pitch, p.frameNo?.() ?? null], up: game.realms.upPart() }; };
  const newTrip = def => ({ to: { place: def.place, arrive: def.arrive, up: { via: def.arrive }, text: `Off to ${def.where}...` }, origin: { ...here(), text: 'Going back...' }, t0: now(), tries: 0, nextAt: 0, moving: false });
  // One step of a trip (there or back): 'there' | 'wait' | 'late'. The host goes; a guest goes once the host is there.
  function drive(trip, to) {
    if ((game.place || 'main') === to.place) return trip.moving ? 'wait' : 'there';
    const t = now();
    if (trip.moving || game.realms.busy || game.inBattle || t < trip.nextAt) return 'wait';
    if (t - trip.t0 > PLAY.tripMax * 1000 || trip.tries >= PLAY.tripTries) return 'late';
    if (!isHost()) { const h = game.mp.hostAvatar; if (!h || (h.place || 'main') !== to.place) return 'wait'; }
    trip.moving = true;
    const done = ok => { trip.moving = false; if (s) s.heardAt = now(); if (!ok) { trip.tries++; trip.nextAt = now() + PLAY.tripWait * 1000; } };
    Promise.resolve().then(() => (isHost() ? game.realms.trip(to) : game.realms.tripFollow(to))).then(done, e => { console.error(e); done(false); });
    return 'wait';
  }

  // Why this kind cannot start with this friend right now ('' = it can).
  function whyNot(def, a) {
    if (!near(a)) return `Walk closer to ${a?.name || 'your friend'} first!`;
    if (game.player.carry) return 'Hop off your ride first!';
    if (away(def) && !canGo(def)) return `Only in ${def.where || 'its own place'}!`;
    return def.whyNot?.(game, a) || '';
  }
  const live = () => (s?.started ? s.play : null); // the kind's own game, once it runs

  // The game itself begins: the leader makes the start, the friend takes it. Both must be in the kind's place with its things there.
  function ready() {
    if (!s || s.started) return false;
    if (s.trip && ((game.place || 'main') !== s.trip.to.place || s.trip.moving || game.realms.busy)) return false;
    if (s.def.shown && !s.def.shown(game)) return false;
    if (!s.leader) return s.startData != null;
    const a = avatarOf(s.partner);
    return !!a && a.here !== false && (!s.trip || (a.place || 'main') === s.trip.to.place);
  }
  function begin() {
    if (!ready()) return;
    s.started = true;
    s.heardAt = now();
    if (s.leader) {
      const data = s.start = s.play.setup();
      send(s.partner, { type: 'start', id: s.id, kind: s.kind, trip: !!s.trip, data });
      s.play.start(data);
    } else { s.start = s.startData; s.play.start(s.startData); }
  }
  // The friend's half of a new session, from whichever message gets here first (`open`, `start` or a heartbeat).
  function join(p) {
    if (s || !pending || pending.id !== p.id || pending.from !== p.from || pending.kind !== p.kind) return false;
    clearTimeout(pending.timer);
    pending = null;
    open(p.kind, p.id, false, p.from, p.name, !!p.trip);
    return true;
  }

  function closeIncomingBox() { if (incoming && game.ui.asked?.onYes === incoming.onYes) game.ui.closeAsk(); }

  function open(kind, id, leader, partner, partnerName, trip = false) {
    const def = FRIEND_GAMES[kind];
    s = { id, kind, def, leader, partner, partnerName, heardAt: now(), beatAt: now(), probeAt: now(), start: null, startData: null, started: false, play: null,
      trip: trip && away(def) ? newTrip(def) : null,
      send: data => send(partner, { ...data, id }),
      finish: text => close('done', text) };
    s.play = def.make(game, s);
    if (game.riding?.creature) game.riding.stop('quiet');
    game.player.keys = {};
    game.touch?.reset();
    hudAt = 0;
    returning = null;
    if (s.trip) game.ui.toast(`${def.icon} Off to ${def.where}!`);
    return s;
  }

  function close(why, text) {
    if (!s) return;
    const old = s;
    s = null;
    if (why === 'done') { let data = null; try { data = old.play.farewell(); } catch (e) { console.error(e); } tomb = { id: old.id, partner: old.partner, data, at: now() }; }
    if (old.started) try { old.play.end(why); } catch (e) { console.error(e); }
    const a = avatarOf(old.partner);
    if (a) a.inGame = false; // their lead creature trots behind them again
    game.ui.setHideSeek(null);
    if (text) game.ui.toast(text);
    // a game with a trip: back to where I was (not when the world itself is going away)
    if (old.trip && why !== 'reset') returning = { to: old.trip.origin, t0: now(), tries: 0, nextAt: 0, moving: false, was: (game.place || 'main') !== old.trip.origin.place || old.trip.moving };
  }

  function accept() {
    const inc = incoming;
    if (!inc) return;
    clearTimeout(inc.timer);
    incoming = null;
    const def = FRIEND_GAMES[inc.kind];
    if (busy() || whyNot(def, avatarOf(inc.from))) { send(inc.from, { type: 'no', id: inc.id, busy: true }); return; }
    send(inc.from, { type: 'yes', id: inc.id, v: PLAY.VERSION });
    pending = { id: inc.id, kind: inc.kind, from: inc.from, name: inc.name, timer: setTimeout(() => {
      pending = null;
      game.ui.toast("Couldn't start the game. Try again!");
    }, 10000) };
  }

  // Something arrived for a game I am not in: say so (at most once a second), so the other side never plays on alone.
  // A game that just ended by its own rules repeats its last word instead (the result).
  function gone(p) {
    const t = now();
    if (!p.id || t - (goneAt[p.id] || 0) < 1000) return;
    goneAt[p.id] = t;
    if (tomb && tomb.id === p.id && tomb.partner === p.from && t - tomb.at < PLAY.tomb * 1000 && tomb.data) send(p.from, { ...tomb.data, type: 'g', id: p.id });
    else send(p.from, { type: 'stop', id: p.id, why: 'gone' });
  }

  function decline() {
    const inc = incoming;
    if (!inc) return;
    clearTimeout(inc.timer);
    incoming = null;
    send(inc.from, { type: 'no', id: inc.id });
  }

  const self = {
    PLAY,
    get active() { return !!s; },
    get kind() { return s?.kind ?? null; },
    get play() { return s?.play ?? null; },
    get busy() { return !!s || !!asking || !!incoming || !!pending || !!returning; },
    get frozen() { return !!live()?.frozen; },
    get noRide() { return live() ? live().noRide : ''; },
    // While a game runs, E / the action button / a tap do the game's own thing and nothing else (main.js updateTarget and the tap):
    // null = no game; else `pick(hit)` keeps a picked player only when it is the friend and the game uses them (tag).
    get only() {
      if (!s) return null;
      const friend = s.started && s.play.usesFriend ? s.partner : null;
      return { pick: hit => (hit && hit.player.id === friend ? hit : null) };
    },
    // On a game's own trip (there, or back): realms.js leaves a guest's "the host went away" rules alone meanwhile.
    get tripping() { return !!returning || (!!s?.trip && !s.started); },
    ticker: null,

    // The friend menu's rows for this friend (swapui.js): [{ id, icon, name, sub, why, go }].
    rows(a) {
      return Object.values(FRIEND_GAMES).filter(shown).map(d => {
        const why = s ? 'Finish your game first!' : returning ? 'Wait a moment...' : whyNot(d, a);
        const sub = why && !s ? why.replace(/!$/, '.') : canGo(d) ? `You both go to ${d.where} and back.` : typeof d.sub === 'function' ? d.sub(game) : d.sub || '';
        return { id: d.id, icon: d.icon, art: d.art ?? d.id, name: d.name, sub, why, go: () => self.invite(d.id, a) };
      });
    },

    // The Play-together box: a Stop button while a game runs.
    menuButtons() {
      return s ? [el('button', { class: 'small', onclick: () => self.stop() }, `Stop ${s.def.name.toLowerCase()}`)] : [];
    },

    invite(kind, a) {
      const def = FRIEND_GAMES[kind];
      if (!def || !a) return;
      if (asking) { game.ui.toast(`Still waiting for ${asking.name} to answer.`); return; }
      if (busy() || returning) { game.ui.toast('Finish what you are doing first, then ask.'); return; }
      const why = whyNot(def, a);
      if (why) { game.ui.toast(why); return; }
      const id = newId();
      asking = { id, kind, to: a.id, name: a.name, timer: setTimeout(() => {
        send(a.id, { type: 'cancel', id });
        asking = null;
        game.ui.toast(`${a.name} didn't answer. Try again later!`);
      }, PLAY.answer * 1000) };
      send(a.id, { type: 'ask', v: PLAY.VERSION, id, kind });
      game.ui.toast(`You asked ${a.name} to play ${def.name.toLowerCase()}. Waiting...`);
    },

    onMessage(p) {
      const t = p.type;
      if (t === 'ask') {
        const def = FRIEND_GAMES[p.kind];
        if (p.v !== PLAY.VERSION || !def) { send(p.from, { type: 'no', id: p.id, old: true }); return; }
        if (busy() || returning || whyNot(def, avatarOf(p.from))) { send(p.from, { type: 'no', id: p.id, busy: true }); return; }
        const inc = incoming = { id: p.id, kind: p.kind, from: p.from, name: p.name, onYes: () => accept(), timer: null };
        inc.timer = setTimeout(() => { closeIncomingBox(); decline(); }, PLAY.answer * 1000);
        game.ui.ask({ text: def.ask(p.name) + (away(def) ? ` You both go to ${def.where} and back.` : ''), yes: "Let's play!", no: 'Not now', kind: 'incoming', onYes: inc.onYes, onNo: () => decline() });
        sound.play('ask');
      } else if (t === 'cancel') {
        if (incoming?.id === p.id) { closeIncomingBox(); clearTimeout(incoming.timer); incoming = null; }
      } else if (t === 'no') {
        if (asking?.id !== p.id) return;
        clearTimeout(asking.timer);
        asking = null;
        game.ui.toast(p.old ? `${p.name} needs to reload the game to play (it was updated).`
          : p.busy ? `${p.name} is busy right now. Try again soon!` : `${p.name} doesn't want to play right now.`);
      } else if (t === 'yes') {
        if (asking?.id !== p.id) return;
        const a = asking;
        clearTimeout(a.timer);
        asking = null;
        const av = avatarOf(p.from), def = FRIEND_GAMES[a.kind];
        if (p.v !== PLAY.VERSION) { game.ui.toast(`${p.name} needs to reload the game to play (it was updated).`); return; }
        if (!av || game.inBattle || s || whyNot(def, av)) { send(p.from, { type: 'stop', id: p.id, why: 'busy' }); return; }
        open(a.kind, p.id, true, p.from, p.name, away(def));
        send(p.from, { type: 'open', id: p.id, kind: a.kind, trip: !!s.trip });
        begin(); // (at once when nobody has to travel)
      } else if (t === 'open') {
        join(p);
      } else if (t === 'start') {
        join(p); // (the `open` got lost)
        if (!s || s.id !== p.id || s.leader || p.from !== s.partner) return;
        if (s.startData == null) s.startData = p.data || {};
        begin();
      } else if (t === 'beat') {
        join(p); // (the `open` and the `start` got lost: this is it)
        if (!s || s.id !== p.id || s.leader || p.from !== s.partner) { gone(p); return; }
        s.heardAt = now();
        send(s.partner, { type: 'pong', id: s.id });
        if (p.start && s.startData == null) s.startData = p.start;
        if (s.started) s.play.heard(p.data || {}); else begin();
      } else if (t === 'pong') {
        if (!s || s.id !== p.id || p.from !== s.partner) { gone(p); return; }
        s.heardAt = now();
      } else if (t === 'g') {
        if (!s || s.id !== p.id || p.from !== s.partner) { if (!(pending && pending.id === p.id)) gone(p); return; }
        s.heardAt = now();
        if (s.started) s.play.message(p);
      } else if (t === 'stop') {
        if (pending?.id === p.id) { clearTimeout(pending.timer); pending = null; game.ui.toast(`${p.name} is busy right now. Try again soon!`); }
        if (s && s.id === p.id && p.from === s.partner) close('stopped', p.why === 'gone' ? `${s.partnerName} is not playing any more. The game is over.` : `${s.partnerName} stopped the game.`);
      }
    },

    // Twice a second: the leader's heartbeat, the other side's watchdog.
    tick() {
      if (incoming && game.ui.asked?.onYes !== incoming.onYes) decline(); // another question replaced ours
      if (!s) return;
      const t = now();
      if (s.started) s.play.tick();
      if (!s) return;
      const quiet = s.started ? PLAY.lost : PLAY.tripLost; // (building a world stops everything for a few seconds: more patience on a trip)
      if (t - s.heardAt > quiet * 1000 && !s.trip?.moving) { close('lost', `Lost touch with ${s.partnerName}. The game is over.`); return; }
      if (s.leader) { // the heartbeat carries the start too: a friend who missed it joins on the next one
        if (t - s.beatAt >= PLAY.beat * 1000) { s.beatAt = t; send(s.partner, { type: 'beat', id: s.id, kind: s.kind, trip: !!s.trip, start: s.start, data: (s.started && s.play.beat()) || {} }); }
      } else if (t - s.heardAt > PLAY.probe * 1000 && t - s.probeAt > PLAY.probe * 1000) { s.probeAt = t; send(s.partner, { type: 'pong', id: s.id }); } // quiet for a while: is the leader still playing?
    },

    update() {
      const t = now(), dt = Math.max(0, (t - last) / 1000); // real seconds, however slow the frames are: both friends' clocks agree
      last = t;
      if (returning && !s) { // the way back after a game with a trip
        const r = drive(returning, returning.to);
        if (r !== 'wait') { if (r === 'there' && returning.was) game.ui.toast('Back where you were!'); returning = null; }
      }
      if (!s) return;
      const a = avatarOf(s.partner);
      if (a && !a.inGame) a.inGame = true; // no lead creature trotting behind them during a game (owner 2026-11-28)
      if (!s.started) { // on the way there, or waiting for the friend to arrive
        if (s.trip && drive(s.trip, s.trip.to) === 'late') {
          send(s.partner, { type: 'stop', id: s.id, why: 'stopped' });
          close('stopped', `Couldn't get to ${s.def.where}. Try again!`);
          return;
        }
        begin();
      }
      if (!s) return;
      if (s.started) {
        if (game.riding?.creature && s.play.noRide) {
          game.riding.stop('quiet');
          if (t - lastToast.ride > PLAY.toastGap * 1000) { lastToast.ride = t; game.ui.toast(s.play.noRide); }
        }
        s.play.update(dt);
        if (!s) return;
      }
      hudAt -= dt;
      if (hudAt > 0) return;
      hudAt = 0.25;
      game.ui.setHideSeek(s.started ? s.play.chip() : { score: `${s.def.icon} ${s.def.name} with ${s.partnerName}`, phase: s.trip ? `Off to ${s.def.where}...` : 'Get ready...' });
    },

    fence(pos, before, vel) { live()?.fence(pos, before, vel); },
    aim(p) { return live()?.aim(p) ?? null; },
    tag(avatar) { return !!s && avatar.id === s.partner && (!s.started || s.play.tag(avatar) !== false); },
    prompt(avatar, how) { return s && avatar.id === s.partner ? (live()?.prompt(avatar, how) ?? `${s.def.name} with ${avatar.name}`) : null; },
    action(avatar) { return s && avatar.id === s.partner ? (live()?.action(avatar) ?? '') : null; },

    blocksBattle(opts) {
      if (!s || opts?.duel) return false;
      const t = now();
      if (t - lastToast.battle > PLAY.toastGap * 1000) { lastToast.battle = t; game.ui.toast('No battles during a game! Press Stop in the pause menu first.'); }
      return true;
    },

    stop() {
      if (!s) return;
      send(s.partner, { type: 'stop', id: s.id, why: 'stopped' });
      close('stopped', 'You stopped the game.');
    },

    left(id) {
      if (s && id === s.partner) close('left', `${s.partnerName} left, so the game is over.`);
      if (asking?.to === id) { clearTimeout(asking.timer); asking = null; }
      if (incoming?.from === id) { closeIncomingBox(); clearTimeout(incoming.timer); incoming = null; }
      if (pending?.from === id) { clearTimeout(pending.timer); pending = null; }
    },

    reset() {
      for (const x of [asking, incoming, pending]) if (x) clearTimeout(x.timer);
      closeIncomingBox();
      asking = incoming = pending = null;
      returning = null;
      close('reset'); // (said by nobody: the friend's next message is answered "gone", or the friend is told you left)
    },

    // For tests.
    state() {
      return { active: !!s, kind: s?.kind ?? null, leader: s?.leader ?? false, asking: !!asking, incoming: !!incoming, pending: !!pending, started: !!s?.started,
        trip: s?.trip ? { to: s.trip.to.place, from: s.trip.origin.place, moving: s.trip.moving } : null, returning: returning ? returning.to.place : null,
        info: (s?.started && s.play.info?.()) || null };
    },
  };
  self.ticker = setInterval(() => self.tick(), 500);
  return self;
}
