// Games for two friends in play together (owner 2026-11-26): tag anywhere, and football, basketball and a kart race in Playland.
// This file is the part every such game shares: asking a friend, yes / no, the start, the leader's heartbeat, stop, leaving.
// One play-together event, `play` (old games never subscribe to it; PLAY.VERSION is checked in the ask). The inviter LEADS
// (the clock and the score are the leader's, like hide and seek). Nothing is saved; no world block changes.
//
// A game KIND is one entry in FRIEND_GAMES (addFriendGame): { id, icon, name, sub, ask(name), shown(game), whyNot(game, avatar),
// make(game, session) -> a FriendGame }. A new game for two = one FriendGame subclass + one addFriendGame. Nothing here knows a kind.
import { sound } from './sound.js';
import { el } from './util.js';

export const PLAY = { VERSION: 1, answer: 30, beat: 1, lost: 10, near: 30, toastGap: 3 };
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
  let last = performance.now(), hudAt = 0;
  const lastToast = { battle: 0, ride: 0 };
  const now = () => performance.now();
  const send = (to, data) => game.mp.sendPlay(to, data);
  const avatarOf = id => game.mp.others.get(id);
  const near = a => !!a && a.here !== false && a.pos.distanceTo(game.player.pos) <= PLAY.near;

  const busy = () => !game.started || game.inBattle || !!s || !!asking || !!incoming || !!pending || game.ui.asking
    || !!game.duels?.incoming || !!game.duels?.asking || !!game.duels?.current || !!game.hideSeek?.active || !!game.swaps?.session || !!game.realms?.busy;

  // Why this kind cannot start with this friend right now ('' = it can).
  function whyNot(def, a) {
    if (!near(a)) return `Walk closer to ${a?.name || 'your friend'} first!`;
    if (game.player.carry) return 'Hop off your ride first!';
    return def.whyNot?.(game, a) || '';
  }

  function closeIncomingBox() { if (incoming && game.ui.asked?.onYes === incoming.onYes) game.ui.closeAsk(); }

  function open(kind, id, leader, partner, partnerName) {
    const def = FRIEND_GAMES[kind];
    s = { id, kind, def, leader, partner, partnerName, heardAt: now(), beatAt: now(), play: null,
      send: data => send(partner, { ...data, id }),
      finish: text => close('done', text) };
    s.play = def.make(game, s);
    if (game.riding?.creature) game.riding.stop('quiet');
    game.player.keys = {};
    game.touch?.reset();
    hudAt = 0;
    return s;
  }

  function close(why, text) {
    if (!s) return;
    const old = s;
    s = null;
    try { old.play.end(why); } catch (e) { console.error(e); }
    game.ui.setHideSeek(null);
    if (text) game.ui.toast(text);
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
    get busy() { return !!s || !!asking || !!incoming || !!pending; },
    get frozen() { return !!s?.play.frozen; },
    get noRide() { return s ? s.play.noRide : ''; },
    ticker: null,

    // The friend menu's rows for this friend (swapui.js): [{ id, icon, name, sub, why, go }].
    rows(a) {
      return Object.values(FRIEND_GAMES).filter(d => !d.shown || d.shown(game)).map(d => {
        const why = s ? 'Finish your game first!' : whyNot(d, a);
        return { id: d.id, icon: d.icon, name: d.name, sub: why && !s ? why.replace(/!$/, '.') : typeof d.sub === 'function' ? d.sub(game) : d.sub || '', why, go: () => self.invite(d.id, a) };
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
      if (busy()) { game.ui.toast('Finish what you are doing first, then ask.'); return; }
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
        if (busy() || whyNot(def, avatarOf(p.from))) { send(p.from, { type: 'no', id: p.id, busy: true }); return; }
        const inc = incoming = { id: p.id, kind: p.kind, from: p.from, name: p.name, onYes: () => accept(), timer: null };
        inc.timer = setTimeout(() => { closeIncomingBox(); decline(); }, PLAY.answer * 1000);
        game.ui.ask({ text: def.ask(p.name), yes: "Let's play!", no: 'Not now', kind: 'incoming', onYes: inc.onYes, onNo: () => decline() });
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
        open(a.kind, p.id, true, p.from, p.name);
        const data = s.play.setup();
        send(p.from, { type: 'start', id: p.id, kind: a.kind, data });
        s.play.start(data);
      } else if (t === 'start') {
        if (s || !pending || pending.id !== p.id || pending.from !== p.from || pending.kind !== p.kind) return;
        clearTimeout(pending.timer);
        pending = null;
        open(p.kind, p.id, false, p.from, p.name);
        s.play.start(p.data || {});
      } else if (t === 'beat') {
        if (!s || s.id !== p.id || s.leader || p.from !== s.partner) return;
        s.heardAt = now();
        s.play.heard(p.data || {});
      } else if (t === 'g') {
        if (!s || s.id !== p.id || p.from !== s.partner) return;
        s.heardAt = now();
        s.play.message(p);
      } else if (t === 'stop') {
        if (pending?.id === p.id) { clearTimeout(pending.timer); pending = null; game.ui.toast(`${p.name} is busy right now. Try again soon!`); }
        if (s && s.id === p.id && p.from === s.partner) close('stopped', `${s.partnerName} stopped the game.`);
      }
    },

    // Twice a second: the leader's heartbeat, the other side's watchdog.
    tick() {
      if (incoming && game.ui.asked?.onYes !== incoming.onYes) decline(); // another question replaced ours
      if (!s) return;
      const t = now();
      s.play.tick();
      if (!s) return;
      if (s.leader) {
        if (t - s.beatAt >= PLAY.beat * 1000) { s.beatAt = t; const data = s.play.beat(); if (data) send(s.partner, { type: 'beat', id: s.id, data }); }
      } else if (t - s.heardAt > PLAY.lost * 1000) close('lost', `Lost touch with ${s.partnerName}. The game is over.`);
    },

    update() {
      const t = now(), dt = Math.max(0, (t - last) / 1000); // real seconds, however slow the frames are: both friends' clocks agree
      last = t;
      if (!s) return;
      if (game.riding?.creature && s.play.noRide) {
        game.riding.stop('quiet');
        if (t - lastToast.ride > PLAY.toastGap * 1000) { lastToast.ride = t; game.ui.toast(s.play.noRide); }
      }
      s.play.update(dt);
      if (!s) return;
      hudAt -= dt;
      if (hudAt > 0) return;
      hudAt = 0.25;
      game.ui.setHideSeek(s.play.chip());
    },

    fence(pos, before, vel) { s?.play.fence(pos, before, vel); },
    tag(avatar) { return !!s && avatar.id === s.partner && s.play.tag(avatar) !== false; },
    prompt(avatar, how) { return s && avatar.id === s.partner ? s.play.prompt(avatar, how) ?? `${s.def.name} with ${avatar.name}` : null; },
    action(avatar) { return s && avatar.id === s.partner ? s.play.action(avatar) ?? '' : null; },

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
      close('reset');
    },

    // For tests.
    state() { return { active: !!s, kind: s?.kind ?? null, leader: s?.leader ?? false, asking: !!asking, incoming: !!incoming, pending: !!pending, info: s?.play.info?.() ?? null }; },
  };
  self.ticker = setInterval(() => self.tick(), 500);
  return self;
}
